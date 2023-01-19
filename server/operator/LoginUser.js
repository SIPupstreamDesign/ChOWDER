/**
 * @classdesc ログインしているユーザのリストを作成する
 */

 class LoginUser{
    constructor(){
        /**
         * ログインユーザのリスト
         * @type {[{controllerID:string, socketID:string}]}
         */
        this.userList = [];
    }

    put(controllerID, socketID){
        this.userList.push({
            controllerID:controllerID,
            socketID:socketID
        });
    }

    delete(socketID){
        for(let i = 0; i < this.userList.length ; i++){
            if(socketID === this.userList[i].socketID){
                this.userList.splice(i,1);
            }
        }
    }

    getUserList(){
        return this.userList;
    }
}
module.exports = LoginUser;
