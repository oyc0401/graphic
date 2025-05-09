import { makeAutoObservable } from "mobx";

class MenuState {
    showMenu = false;
    showColorMenu = false;

    // 모바일
    showSizeBar = false;
    showTools = true;

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
    setShowSizeBar(value) {
        this.showSizeBar = value;
    }

    closeAllMenu() {
        this.showMenu = false;
    }
}

export const menuState = new MenuState();
