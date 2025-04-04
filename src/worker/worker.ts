// 웹워커 쓰레드 js 파일
import * as Comlink from "comlink";
import { workerApi } from "./paintController";

console.log("worker!");

Comlink.expose(workerApi);
