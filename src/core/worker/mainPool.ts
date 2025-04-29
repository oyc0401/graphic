import { Callink } from "./Callink";
import { mainApi } from "./mainController";

type MainApi = typeof mainApi;

export const mainThread = Callink.wrap<MainApi>();
