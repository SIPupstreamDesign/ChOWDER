/**
 * @classdesc ログインしているユーザのリストを作成する
 */

 class LoginUser{
    constructor(){
        /**
         * ログインユーザのリスト。socketIDがユニークになる設計
         * @type {[{controllerID:string, socketID:string, groupID:string}]}
         */
        this.userList = [];
    }

    put(controllerID, socketID, groupID){
        for(let i = 0; i < this.userList.length ; i++){
            if(socketID === this.userList[i].socketID){ // もし既にあるsocketIDなら追加はしない
                return;
            }
        }
        this.userList.push({
            controllerID : controllerID,
            socketID : socketID,
            groupID : groupID
        });
    }

    delete(socketID){
        for(let i = 0; i < this.userList.length ; i++){
            if(socketID === this.userList[i].socketID){
                this.userList.splice(i,1);
            }
        }
    }

    getList(){
        return this.userList;
    }

    getGroupIDFromSocketID(socketID){
        const user = this.userList.find((user)=>{
            if(user.socketID === socketID){
                return true;
            }
            return false;
        });
        if(user !== undefined){
            return null;
        }
        return user.groupID;
    }

    getAllStatusFromSocketID(socketID){
        const user = this.userList.find((user)=>{
            if(user.socketID === socketID){
                return true;
            }
            return false;
        });
        if(user === undefined){
            return null;
        }
        return user;
    }

    updateControllerID(socketID, controllerID){
        const user = this.userList.find((user)=>{
            if(user.socketID === socketID){
                return true;
            }
            return false;
        });
        if(user === undefined){
            return false;
        }
        user.controllerID = controllerID;
        return true;
    }
}
module.exports = LoginUser;
