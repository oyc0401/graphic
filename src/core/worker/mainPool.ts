import { Callink } from "callink";
import { mainApi } from "./mainController";

type MainApi = typeof mainApi;

export const mainThread = Callink.connect<MainApi>();
