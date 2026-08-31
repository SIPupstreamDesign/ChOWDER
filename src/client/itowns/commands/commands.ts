/**
 * WebSocket コマンド名定数
 * command.js の TypeScript 移植
 */
export const Command = {
    AddContent: 'AddContent',
    GetMetaData: 'GetMetaData',
    UpdateMetaData: 'UpdateMetaData',
    UpdateWindowMetaData: 'UpdateWindowMetaData',
    UpdateContent: 'UpdateContent',
    DeleteContent: 'DeleteContent',
    SendMessage: 'SendMessage',
    GetGlobalSetting: 'GetGlobalSetting',
    Login: 'Login',
    Logout: 'Logout',
    Upload: 'Upload',
    // itowns2 自動ログイン用
    LoginWithOTP: 'LoginWithOTP',
} as const;

export type CommandType = typeof Command[keyof typeof Command];
