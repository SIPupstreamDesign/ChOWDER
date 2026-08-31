import type { LogFn } from '../websocket/WebSocketClient';

export type SendCommandFn = (method: string, params?: any) => Promise<any>;

/** ロール文字列が管理者かを判定する純粋関数 */
export function isAdmin(role: string | null): boolean {
    return role === 'admin';
}

export class AuthManager {
    private _isAuthenticated = false;
    private _currentUser: string | null = null;
    private _currentRole: string | null = null;
    private _socketId: string | null = null;

    constructor(
        private readonly sendCmd: SendCommandFn,
        private readonly logFn: LogFn,
    ) {}

    get isAuthenticated(): boolean { return this._isAuthenticated; }
    get currentUser(): string | null { return this._currentUser; }
    get currentRole(): string | null { return this._currentRole; }
    get socketId(): string | null { return this._socketId; }

    isAdmin(): boolean {
        return isAdmin(this._currentRole);
    }

    async login(userId: string, password: string): Promise<{ success: boolean; userId: string; role: string; socketId: string }> {
        this.logFn(`Logging in as ${userId}...`, 'info');
        const result = await this.sendCmd('Login', { id: userId, password });

        if (result.success) {
            this._isAuthenticated = true;
            this._currentUser = result.userId;
            this._currentRole = result.role;
            this._socketId = result.socketId;
            this.logFn(`✅ Logged in successfully as ${userId}`, 'success');
        }
        return result;
    }

    async logout(): Promise<void> {
        await this.sendCmd('Logout', {});
        this._isAuthenticated = false;
        this._currentUser = null;
        this._currentRole = null;
        this._socketId = null;
        this.logFn('Logged out successfully', 'success');
    }

    async createUser(userId: string, password: string, role: string): Promise<void> {
        this.logFn(`Creating user ${userId}...`, 'info');
        const result = await this.sendCmd('CreateUser', { id: userId, password, role });
        if (result.success) {
            this.logFn(`✅ User ${userId} created successfully`, 'success');
        }
    }

    async getUserList(): Promise<{ userId: string; role: string; createdAt: string }[]> {
        const result = await this.sendCmd('GetUserList', {});
        return result.users ?? [];
    }

    async deleteUser(userId: string): Promise<void> {
        this.logFn(`Deleting user ${userId}...`, 'info');
        const result = await this.sendCmd('DeleteUser', { id: userId });
        if (result.success) {
            this.logFn(`✅ User ${userId} deleted`, 'success');
        }
    }

    async changeUserPassword(userId: string, newPassword: string): Promise<void> {
        this.logFn(`Changing password for ${userId}...`, 'info');
        const result = await this.sendCmd('ChangePassword', { id: userId, password: newPassword });
        if (result.success) {
            this.logFn(`✅ Password changed for ${userId}`, 'success');
        }
    }

    async changeOwnPassword(id: string, oldPassword: string, newPassword: string): Promise<{ success: boolean }> {
        this.logFn(`Changing own password...`, 'info');
        const result = await this.sendCmd('ChangeOwnPassword', { id, oldPassword, newPassword });
        return result;
    }
}
