import { makeAutoObservable } from "mobx";

class MenuState {
    showMenu = false;

    constructor() {
        makeAutoObservable(this);
    }

    setShowMenu(value) {
        this.showMenu = value;
    }

    closeAllMenu(){
         this.showMenu = false;
    }
}

export const menuState = new MenuState();
