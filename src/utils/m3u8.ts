const fs = require("fs");
import M3U8 from "../core/m3u8";
import Logger from "../utils/log";
import UA from "./ua";
import axios, { AxiosRequestConfig } from "axios";
import { AxiosProxyConfig } from "axios";
import { URL } from "url";
const SocksProxyAgent = require("socks-proxy-agent");

export async function loadM3U8(
    Log: Logger,
    path: string,
    retries: number = 1,
    timeout = 60000,
    proxy: AxiosProxyConfig = undefined,
    options: AxiosRequestConfig = {}
) {
    let m3u8Content;
    if (path.startsWith("http")) {
        Log.info("Start fetching M3U8 file.");
        while (retries >= 0) {
            try {
                const response = await axios.get(path, {
                    timeout,
                    httpsAgent: proxy
                        ? new SocksProxyAgent(`socks5h://${proxy.host}:${proxy.port}`)
                        : undefined,
                    headers: {
                        "User-Agent": UA.CHROME_DEFAULT_UA,
                        Host: new URL(path).host,
                    },
                    ...options,
                });
                Log.info("M3U8 file fetched.");
                m3u8Content = response.data;
                break;
            } catch (e) {
                Log.warning(
                    `Fail to fetch M3U8 file: [${
                        e.code ||
                        (e.response
                            ? `${e.response.status} ${e.response.statusText}`
                            : undefined) ||
                        "UNKNOWN"
                    }]`
                );
                Log.warning(
                    "If you are downloading a live stream, this may result in a broken output video."
                );
                retries--;
                if (retries >= 0) {
                    Log.info("Try again.");
                } else {
                    Log.warning("Max retries exceeded. Abort.");
                    throw new Error(e);
                }
            }
        }
    } else {
        // is a local file path
        if (!fs.existsSync(path)) {
            throw new Error(`File '${path}' not found.`);
        }
        Log.info("Loading M3U8 file.");
        m3u8Content = fs.readFileSync(path).toString();
    }
    return new M3U8(m3u8Content, path);
}
