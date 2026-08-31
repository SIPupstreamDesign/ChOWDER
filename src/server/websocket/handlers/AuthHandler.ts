import { SessionManager } from '../../auth/sessionManager';
import { AuthService, UserRole } from '../../auth/authService';
import { OtpService } from '../../auth/otpService';
import { Command } from '../command';

type ResultCallback = (err: any, res?: any, binary?: Buffer) => void;

export interface AuthHandlerDeps {
    sessionManager: SessionManager;
    authService: AuthService;
    otpService: OtpService;
    notifyExistingStreams: (socketId: string) => Promise<void>;
    revokeUserSessionsAndDisconnect: (userId: string) => Promise<void>;
}

export class AuthHandler {
    private sessionManager: SessionManager;
    private authService: AuthService;
    private otpService: OtpService;
    private notifyExistingStreams: (socketId: string) => Promise<void>;
    private revokeUserSessionsAndDisconnect: (userId: string) => Promise<void>;

    constructor(deps: AuthHandlerDeps) {
        this.sessionManager = deps.sessionManager;
        this.authService = deps.authService;
        this.otpService = deps.otpService;
        this.notifyExistingStreams = deps.notifyExistingStreams;
        this.revokeUserSessionsAndDisconnect = deps.revokeUserSessionsAndDisconnect;
    }

    /**
     * OTPサービスの設定
     */
    setOtpService(otpService: OtpService): void {
        this.otpService = otpService;
    }

    /**
     * 認証チェック
     */
    private async checkAuth(socketId: string, resultCallback: ResultCallback): Promise<boolean> {
        const isAuthenticated = await this.sessionManager.isAuthenticated(socketId);
        if (!isAuthenticated) {
            resultCallback({ code: -32001, message: 'Authentication required' });
            return false;
        }
        return true;
    }

    /**
     * Admin権限チェック
     */
    private async checkAdminAuth(socketId: string, resultCallback: ResultCallback): Promise<boolean> {
        const isAdmin = await this.sessionManager.isAdmin(socketId);
        if (!isAdmin) {
            resultCallback({ code: -32002, message: 'Admin permission required' });
            return false;
        }
        return true;
    }

    /**
     * ログイン
     */
    async login(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        console.log(`[AuthHandler] Login called for socket ${socketId}`);

        const { id, password } = data;

        if (!id || !password) {
            resultCallback({ code: -32003, message: 'Missing id or password' });
            return;
        }

        const authResult = await this.authService.authenticate(id, password);

        if (!authResult.success) {
            resultCallback({ code: -32004, message: 'Invalid credentials' });
            return;
        }

        await this.sessionManager.createSession(socketId, id, authResult.role!);

        // ログイン成功時に既存の配信を通知
        await this.notifyExistingStreams(socketId);

        resultCallback(null, { success: true, userId: id, role: authResult.role, socketId });
    }

    /**
     * itowns用OTPトークンを発行する
     * ログイン済みコントローラのみ発行可能
     */
    async requestOTP(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) {
            return;
        }

        const session = await this.sessionManager.getSession(socketId);
        if (!session) {
            resultCallback({ code: -32001, message: 'Authentication required' });
            return;
        }

        const token = await this.otpService.generateOTP(session.userId, session.role);
        resultCallback(null, { token });
    }

    /**
     * OTPトークンを使ったログイン（itowns自動ログイン用）
     */
    async loginWithOTP(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        const { token } = data;

        if (!token) {
            resultCallback({ code: -32003, message: 'Missing token' });
            return;
        }

        const otpPayload = await this.otpService.consumeOTP(token);
        if (!otpPayload) {
            resultCallback({ code: -32004, message: 'OTP expired or invalid' });
            return;
        }

        await this.sessionManager.createSession(socketId, otpPayload.userId, otpPayload.role);

        // ログイン成功時に既存の配信を通知
        await this.notifyExistingStreams(socketId);

        resultCallback(null, { success: true, userId: otpPayload.userId, role: otpPayload.role, socketId });
    }

    /**
     * ログアウト
     */
    async logout(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        console.log(`[AuthHandler] Logout called for socket ${socketId}`);

        await this.sessionManager.removeSession(socketId);
        resultCallback(null, { success: true });
    }

    /**
     * ユーザー作成
     * - Admin: 全ロール作成可能
     * - ContentManager: Admin以外のロール作成可能
     */
    async createUser(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        const session = await this.sessionManager.getSession(socketId);
        if (!session) {
            resultCallback({ code: -32001, message: 'Authentication required' });
            return;
        }

        console.log(`[AuthHandler] CreateUser called by socket ${socketId} (Role: ${session.role})`);

        const { id, password, role } = data;

        if (!id || !password || !role) {
            resultCallback({ code: -32005, message: 'Missing id, password, or role' });
            return;
        }

        if (role !== UserRole.ADMIN && role !== UserRole.MEMBER) {
            resultCallback({ code: -32006, message: 'Invalid role' });
            return;
        }

        // 権限チェック
        if (session.role === UserRole.ADMIN) {
            // Adminは制限なし
        } else {
            // その他のロールは作成権限なし
            resultCallback({ code: -32002, message: 'Permission denied' });
            return;
        }

        const success = await this.authService.createUser(id, password, role);

        if (!success) {
            resultCallback({ code: -32007, message: 'User already exists' });
            return;
        }

        resultCallback(null, { success: true, userId: id });
    }

    /**
     * 全ユーザー一覧取得（Admin専用）
     */
    async getUserList(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAdminAuth(socketId, resultCallback)) {
            return;
        }

        const users = await this.authService.getAllUsers();
        resultCallback(null, { users });
    }

    /**
     * ユーザー削除（Admin専用）
     * - 自分自身は削除不可
     * - Adminが1人の場合はAdminを削除不可
     */
    async deleteUser(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAdminAuth(socketId, resultCallback)) {
            return;
        }

        const { id } = data;
        if (!id) {
            resultCallback({ code: -32005, message: 'Missing id' });
            return;
        }

        const session = await this.sessionManager.getSession(socketId);
        if (session?.userId === id) {
            resultCallback({ code: -32002, message: 'Cannot delete yourself' });
            return;
        }

        const targetUser = await this.authService.getUser(id);
        if (!targetUser) {
            resultCallback({ code: -32008, message: 'User not found' });
            return;
        }

        if (targetUser.role === 'admin') {
            const allUsers = await this.authService.getAllUsers();
            const adminCount = allUsers.filter((u) => {
                return u.role === 'admin';
            }).length;
            if (adminCount <= 1) {
                resultCallback({ code: -32002, message: 'Cannot delete the last admin user' });
                return;
            }
        }

        const success = await this.authService.deleteUser(id);
        if (!success) {
            resultCallback({ code: -32008, message: 'User not found' });
            return;
        }

        await this.revokeUserSessionsAndDisconnect(id);

        resultCallback(null, { success: true, userId: id });
    }

    /**
     * パスワード変更（Admin専用）
     */
    async changePassword(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAdminAuth(socketId, resultCallback)) {
            return;
        }

        const { id, password } = data;
        if (!id || !password) {
            resultCallback({ code: -32005, message: 'Missing id or password' });
            return;
        }

        const success = await this.authService.changePassword(id, password);
        if (!success) {
            resultCallback({ code: -32008, message: 'User not found' });
            return;
        }

        resultCallback(null, { success: true, userId: id });
    }

    /**
     * 自身のパスワード変更（全ユーザー・旧パスワード検証あり・ログイン不要）
     */
    async changeOwnPassword(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        const { id, oldPassword, newPassword } = data;
        if (!id || !oldPassword || !newPassword) {
            resultCallback({ code: -32005, message: 'Missing id, oldPassword or newPassword' });
            return;
        }

        const success = await this.authService.changeOwnPassword(id, oldPassword, newPassword);
        if (!success) {
            resultCallback({ code: -32004, message: 'Invalid credentials or user not found' });
            return;
        }

        resultCallback(null, { success: true, userId: id });
    }

    /**
     * ログインユーザーリスト取得
     */
    async getLoginUserList(data: any, resultCallback: ResultCallback, socketId: string): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) {
            return;
        }

        const sessions = await this.sessionManager.getAllSessions();
        const users = sessions.map((s) => {
            return { userId: s.userId, role: s.role, loginAt: s.loginAt };
        });
        resultCallback(null, { users });
    }

    /**
     * 自身のステータス取得
     */
    async getSelfStatus(socketId: string, data: any, resultCallback: ResultCallback): Promise<void> {
        if (!await this.checkAuth(socketId, resultCallback)) {
            return;
        }

        resultCallback(null, { socketId, status: 'connected' });
    }
}
