import { makeAutoObservable } from "mobx";

export class MenuState {

    constructor() {
        makeAutoObservable(this);
    }

}

export const menuState = new MenuState();
