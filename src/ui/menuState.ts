import { makeAutoObservable } from "mobx";

class MenuState {
    showMenu = false;
    showColorMenu = false;

    showTools = false; // 모바일
    constructor() {
        makeAutoObservable(this);
    }

    setShowMenu(value) {
        this.showMenu = value;
    }
    setShowColorMenu(value) {
        this.showColorMenu = value;
    }
    setShowTools(value) {
        this.showTools = value;
    }
    closeAllMenu() {
        this.showMenu = false;
    }
}

export const menuState = new MenuState();
