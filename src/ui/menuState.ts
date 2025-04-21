import { makeAutoObservable } from "mobx";

class MenuState {
    showMenu = false;
    showColorMenu = false;
    constructor() {
        makeAutoObservable(this);
    }

    setShowMenu(value) {
        this.showMenu = value;
    }
    setShowColorMenu(value) {
        this.showColorMenu = value;
    }
    closeAllMenu() {
        this.showMenu = false;
    }
}

export const menuState = new MenuState();
