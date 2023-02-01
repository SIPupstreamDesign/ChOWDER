/**
 * @classdesc ログインしているユーザのリストを作成する
 */

 class LoginUser{
    constructor(){
        /**
         * ログインユーザのリスト
         * @type {[{controllerID:string, socketID:string, groupID:string}]}
         */
        this.userList = [];
    }

    put(controllerID, socketID, groupID){
        for(let i = 0; i < this.userList.length ; i++){
            if(socketID === this.userList[i].socketID){
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
        return user.groupID;
    }
}
module.exports = LoginUser;
