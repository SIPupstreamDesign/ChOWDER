/**
 * WebSocketインターフェース - コマンドハンドラの登録
 */

import { WSConnector } from './wsConnector';
import { Command } from './command';
import { CommandHandler } from './commandHandler';

/**
 * WebSocketインターフェースクラス
 */
export class WSInterface {
    private wsConnector: WSConnector;
    private commandHandler: CommandHandler;

    constructor(wsConnector: WSConnector, commandHandler: CommandHandler) {
        this.wsConnector = wsConnector;
        this.commandHandler = commandHandler;
    }

    /**
     * WebSocketイベントの登録
     */
    registerWSEvent(): void {
        // ユーザー関連
        this.wsConnector.on(Command.GetLoginUserList, (data, resultCallback, socketId) => {
            this.commandHandler.getLoginUserList(data, resultCallback, socketId);
        });

        this.wsConnector.on(Command.GetSelfStatus, (data, resultCallback, socketId) => {
            this.commandHandler.getSelfStatus(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.GetServerConfig, (data, resultCallback, socketId) => {
            this.commandHandler.getServerConfig(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.UpdateLoginUserControllerID, (data, resultCallback, socketId) => {
            this.commandHandler.updateLoginUserControllerID(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.Login, (data, resultCallback, socketId) => {
            this.commandHandler.login(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.Logout, (data, resultCallback, socketId) => {
            this.commandHandler.logout(socketId, data, resultCallback);
        });

        // itowns 自動ログイン用OTP
        this.wsConnector.on(Command.RequestOTP, (data, resultCallback, socketId) => {
            this.commandHandler.requestOTP(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.LoginWithOTP, (data, resultCallback, socketId) => {
            this.commandHandler.loginWithOTP(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.CreateUser, (data, resultCallback, socketId) => {
            this.commandHandler.createUser(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.DeleteUser, (data, resultCallback, socketId) => {
            this.commandHandler.deleteUser(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.ChangePassword, (data, resultCallback, socketId) => {
            this.commandHandler.changePassword(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.ChangeOwnPassword, (data, resultCallback, socketId) => {
            this.commandHandler.changeOwnPassword(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.GetUserList, (data, resultCallback, socketId) => {
            this.commandHandler.getUserList(socketId, data, resultCallback);
        });

        // メタデータ関連
        this.wsConnector.on(Command.AddMetaData, (data, resultCallback, socketId) => {
            this.commandHandler.addMetaData(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.GetMetaData, (data, resultCallback, socketId) => {
            this.commandHandler.getMetaData(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.UpdateMetaData, (data, resultCallback, socketId) => {
            this.commandHandler.updateMetaData(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.UpdateCameraMatrix, (data, resultCallback, socketId) => {
            this.commandHandler.updateCameraMatrix(socketId, data, resultCallback);
        });

        // コンテンツ関連
        this.wsConnector.on(Command.AddContent, (data, resultCallback, socketId) => {
            this.commandHandler.addContent(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.GetContent, (data, resultCallback, socketId) => {
            this.commandHandler.getContent(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.GetTileContent, (data, resultCallback, socketId) => {
            this.commandHandler.getTileContent(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.UploadTileimage, (data, resultCallback, socketId) => {
            this.commandHandler.uploadTileimage(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.UpdateContent, (data, resultCallback, socketId) => {
            console.log('[WSInterface] Received UpdateContent command', data);
            this.commandHandler.updateContent(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.DeleteContent, (data, resultCallback, socketId) => {
            this.commandHandler.deleteContent(socketId, data, resultCallback);
        });

        // ウィンドウメタデータ関連
        this.wsConnector.on(Command.AddWindowMetaData, (data, resultCallback, socketId) => {
            this.commandHandler.addWindowMetaData(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.GetWindowMetaData, (data, resultCallback, socketId) => {
            this.commandHandler.getWindowMetaData(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.UpdateWindowMetaData, (data, resultCallback, socketId) => {
            this.commandHandler.updateWindowMetaData(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.DeleteWindowMetaData, (data, resultCallback, socketId) => {
            this.commandHandler.deleteWindowMetaData(socketId, data, resultCallback);
        });

        // DisplaySpace 関連
        this.wsConnector.on(Command.GetDisplaySpace, (data, resultCallback, socketId) => {
            this.commandHandler.getDisplaySpace(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.UpdateDisplaySpace, (data, resultCallback, socketId) => {
            this.commandHandler.updateDisplaySpace(socketId, data, resultCallback);
        });

        // Site 管理
        this.wsConnector.on(Command.GetSiteList, (data, resultCallback, socketId) => {
            this.commandHandler.getSiteList(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.GetSite, (data, resultCallback, socketId) => {
            this.commandHandler.getSite(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.CreateSite, (data, resultCallback, socketId) => {
            this.commandHandler.createSite(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.UpdateSite, (data, resultCallback, socketId) => {
            this.commandHandler.updateSite(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.DeleteSite, (data, resultCallback, socketId) => {
            this.commandHandler.deleteSite(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.GetDisplaysBySite, (data, resultCallback, socketId) => {
            this.commandHandler.getDisplaysBySite(socketId, data, resultCallback);
        });

        // その他
        this.wsConnector.on(Command.UpdateMouseCursor, (data, resultCallback, socketId) => {
            this.commandHandler.updateMouseCursor(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.SendMessage, (data, resultCallback, socketId) => {
            this.commandHandler.sendMessage(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.ReloadDisplay, (data, resultCallback, socketId) => {
            this.commandHandler.reloadDisplay(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.RefreshDisplayContent, (data, resultCallback, socketId) => {
            this.commandHandler.refreshDisplayContent(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.MeasureDisplay, (data, resultCallback, socketId) => {
            this.commandHandler.measureDisplay(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.ShowWindowID, (data, resultCallback, socketId) => {
            this.commandHandler.showWindowID(socketId, data, resultCallback);
        });

        // ディスプレイセッション関連
        this.wsConnector.on(Command.RegisterDisplay, (data, resultCallback, socketId) => {
            this.commandHandler.registerDisplay(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.GetPendingDisplays, (data, resultCallback, socketId) => {
            this.commandHandler.getPendingDisplays(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.GetApprovedDisplays, (data, resultCallback, socketId) => {
            this.commandHandler.getApprovedDisplays(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.ApproveDisplay, (data, resultCallback, socketId) => {
            this.commandHandler.approveDisplay(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.RejectDisplay, (data, resultCallback, socketId) => {
            this.commandHandler.rejectDisplay(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.DeleteDisplay, (data, resultCallback, socketId) => {
            this.commandHandler.deleteDisplay(socketId, data, resultCallback);
        });
        this.wsConnector.on(Command.ChangeDisplayName, (data, resultCallback, socketId) => {
            this.commandHandler.changeDisplayName(socketId, data, resultCallback);
        });
        // mediasoup 関連
        this.wsConnector.on(Command.GetRouterRtpCapabilities, (data, resultCallback, socketId) => {
            this.commandHandler.getRouterRtpCapabilities(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.CreateWebRtcTransport, (data, resultCallback, socketId) => {
            this.commandHandler.createWebRtcTransport(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.ConnectWebRtcTransport, (data, resultCallback, socketId) => {
            this.commandHandler.connectWebRtcTransport(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.Produce, (data, resultCallback, socketId) => {
            this.commandHandler.produce(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.CloseProducer, (data, resultCallback, socketId) => {
            this.commandHandler.closeProducer(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.Consume, (data, resultCallback, socketId) => {
            this.commandHandler.consume(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.ResumeConsumer, (data, resultCallback, socketId) => {
            this.commandHandler.resumeConsumer(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.GetActiveProducers, (data, resultCallback, socketId) => {
            this.commandHandler.getActiveProducers(socketId, data, resultCallback);
        });

        // ContentsLayout
        this.wsConnector.on(Command.SaveContentsLayout, (data, resultCallback, socketId) => {
            this.commandHandler.saveContentsLayout(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.GetContentsLayoutList, (data, resultCallback, socketId) => {
            this.commandHandler.getContentsLayoutList(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.GetContentsLayout, (data, resultCallback, socketId) => {
            this.commandHandler.getContentsLayout(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.RestoreContentsLayout, (data, resultCallback, socketId) => {
            this.commandHandler.restoreContentsLayout(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.DeleteContentsLayout, (data, resultCallback, socketId) => {
            this.commandHandler.deleteContentsLayout(socketId, data, resultCallback);
        });

        // サムネイル
        this.wsConnector.on(Command.GetThumbnail, (data, resultCallback, socketId) => {
            this.commandHandler.getThumbnail(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.UpdateThumbnail, (data, resultCallback, socketId) => {
            this.commandHandler.updateThumbnail(socketId, data, resultCallback);
        });

        this.wsConnector.on(Command.InspectContentData, (data, resultCallback, socketId) => {
            this.commandHandler.inspectContentData(socketId, data, resultCallback);
        });
    }
}
