import { URL } from "url";

/**
 * M3U8 Parser
 */

export interface M3U8Chunk {
    url: string;
    key?: string;
    iv?: string;
    sequenceId?: string;
}

export class M3U8ParseError extends Error {}

export default class M3U8 {
    m3u8Content: string;
    m3u8Url: string;
    isEncrypted: boolean;
    isEnd: boolean;
    key: string;
    iv: string;
    sequenceId: string;
    chunks: M3U8Chunk[] = [];
    properties: {};

    constructor(m3u8: string, m3u8Url: string = "") {
        this.m3u8Content = m3u8;
        this.m3u8Url = m3u8Url;
        this.parse();
    }

    /**
     * 解析基本属性
     */
    parse() {
        this.isEncrypted = this.m3u8Content.match(/EXT-X-KEY:METHOD=AES-128,URI="(.+)"/) !== null;
        this.isEnd = this.m3u8Content.match(/EXT-X-ENDLIST/) !== null;

        let inHeaderPart = true;
        let key: string, iv: string, sequenceId: string;
        for (let line of this.m3u8Content.split("\n")) {
            /**
             * v8 引擎内部对 split/slice 出的字符串有一个对 parent 的引用
             * 并且默认不会被 GC 当 parent string 很长时会造成内存泄漏
             * 此处复制了一次字符串避免此情况
             * See also: https://github.com/nodejs/help/issues/711
             */
            line = line.split("").join("").trim();
            if (line.startsWith("#")) {
                // it is a m3u8 property
                if (line.startsWith("#EXT-X-KEY")) {
                    if (line.startsWith("#EXT-X-KEY:METHOD=NONE")) {
                        // No Encryption
                    } else {
                        if (inHeaderPart) {
                            this.isEncrypted = true;
                            this.key = line.match(/EXT-X-KEY:METHOD=AES-128,URI="(.+)"/)[1];
                            this.iv = line.match(/IV=0x(.+)/) && line.match(/IV=0x(.+)/)[1];
                        } else {
                            key = line.match(/EXT-X-KEY:METHOD=AES-128,URI="(.+)"/)[1];
                            iv = line.match(/IV=0x(.+)/) && line.match(/IV=0x(.+)/)[1];
                        }
                    }
                }
                if (line.startsWith("#EXT-X-MEDIA-SEQUENCE")) {
                    if (inHeaderPart) {
                        this.sequenceId = line.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/)[1];
                    } else {
                        sequenceId = line.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/)[1];
                    }
                }
            } else {
                // normal video chunk
                if (!line) {
                    continue;
                }
                inHeaderPart = false;
                const newChunk: M3U8Chunk = {
                    url: "",
                };
                if (line.startsWith("http")) {
                    newChunk.url = line;
                } else if (line.startsWith("//")) {
                    if (this.m3u8Url) {
                        newChunk.url = new URL(this.m3u8Url).protocol + line;
                    } else {
                        throw new M3U8ParseError("Missing full url for m3u8.");
                    }
                } else if (line.startsWith("/")) {
                    if (this.m3u8Url) {
                        newChunk.url =
                            this.m3u8Url.match(/(htt(p|ps):\/\/.+?\/)/)[1] + line.slice(1);
                    } else {
                        throw new M3U8ParseError("Missing full url for m3u8.");
                    }
                } else {
                    if (this.m3u8Url) {
                        const pathWithoutParams =
                            new URL(this.m3u8Url).origin + new URL(this.m3u8Url).pathname;
                        newChunk.url = `${pathWithoutParams
                            .split("/")
                            .slice(0, -1)
                            .join("/")}/${line}`;
                    } else {
                        throw new M3U8ParseError("Missing full url for m3u8.");
                    }
                }
                if (key) {
                    newChunk.key = key;
                }
                if (iv) {
                    newChunk.iv = iv;
                }
                if (sequenceId) {
                    newChunk.sequenceId = sequenceId;
                }
                this.chunks.push(newChunk);
            }
        }
    }

    /**
     * 获得加密Key
     */
    getKey() {
        return this.isEncrypted && this.m3u8Content.match(/EXT-X-KEY:METHOD=AES-128,URI="(.+)"/)[1];
    }

    /**
     * 获得加密IV
     */
    getIV() {
        return (
            this.isEncrypted &&
            this.m3u8Content.match(/IV=0x(.+)/)?.[1]
        );
    }

    /**
     * 获得块长度
     */
    getChunkLength() {
        return parseFloat(this.m3u8Content.match(/#EXTINF:(.+?)(,|$)/m)?.[1] ?? "5.000");
    }
}
