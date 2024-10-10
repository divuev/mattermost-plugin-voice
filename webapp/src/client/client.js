import request from 'superagent';
import {Client4} from 'mattermost-redux/client';

import {getPluginURL} from '../utils.js';

import Recorder from './recorder.js';

export default class Client {
    constructor() {
        this._onUpdate = null;
        this.timerID = null;
        this.recorder = new Recorder({
            workerURL: `${getPluginURL()}/public/recorder.worker.js`,
        });
        request.get(`${getPluginURL()}/config`).accept('application/json').then((res) => {
            this.recorder.init({
                maxDuration: parseInt(res.body.VoiceMaxDuration, 10),
                bitRate: parseInt(res.body.VoiceAudioBitrate, 10),
            }).then(() => {
                // console.log('client: recorder initialized');
            });
        });
        this.recorder.on('maxduration', () => {
            if (this.timerID) {
                clearInterval(this.timerID);
            }
            this.recorder.stop().then((recording) => {
                this._recording = recording;
                if (this._onUpdate) {
                    this._onUpdate(0);
                }
            });
        });
    }

    startRecording(channelId, rootId) {
        // console.log('client: start recording');
        this.channelId = channelId || null;
        this.rootId = rootId || null;
        this._recording = null;
        return this.recorder.start().then(() => {
            this.timerID = setInterval(() => {
                if (this._onUpdate && this.recorder.startTime) {
                    this._onUpdate(new Date().getTime() - this.recorder.startTime);
                }
            }, 200);
        });
    }

    stopRecording() {
        // console.log('client: stop recording');
        if (this.timerID) {
            clearInterval(this.timerID);
        }
        this._onUpdate = null;
        return this.recorder.stop();
    }

    cancelRecording() {
        // console.log('client: cancel recording');
        if (this.timerID) {
            clearInterval(this.timerID);
        }
        this._onUpdate = null;
        return this.recorder.cancel();
    }

    _sendRecording({channelId, rootId, recording}) {
        const recordFilename = `${new Date().getTime() - recording.duration}.mp3`;

        const saveFileToLocalStorage = (file, filename) => {
            if (!localStorage.getItem(filename)) {
                localStorage.setItem(filename, JSON.stringify(file));
            }
        };

        const removeFileFromLocalStorage = (filename) => {
            localStorage.removeItem(filename);
        };

        const getFileFromLocalStorage = (filename) => {
            const fileData = localStorage.getItem(filename);
            return fileData ? JSON.parse(fileData) : null;
        };

        const sendRecording = (attempt) => {
            return new Promise((resolve, reject) => {
                const fileKey = `audioFile_${recordFilename}`;
                const fileToSend = getFileFromLocalStorage(fileKey) || recording.blob;

                request.
                post(Client4.getFilesRoute()).
                set(Client4.getOptions({method: 'post'}).headers).
                attach('files', fileToSend, recordFilename).
                field('channel_id', channelId).
                accept('application/json').then((res) => {
                    removeFileFromLocalStorage(fileKey);

                    const data = {
                        channel_id: channelId,
                        root_id: rootId,
                        message: 'Voice Message',
                        type: 'custom_voice',
                        props: {
                            fileId: res.body.file_infos[0].id,
                            duration: recording.duration,
                        },
                    };
                    request.post(Client4.getPostsRoute()).
                    set(Client4.getOptions({method: 'post'}).headers).
                    send(data).
                    accept('application/json').then(resolve).catch((err) => {
                        if (attempt < 30) {
                            setTimeout(5000);
                            sendRecording(attempt + 1).then(resolve).catch(reject);
                        } else {
                            removeFileFromLocalStorage(fileKey);
                            reject(err);
                        }
                    });
                }).catch(reject);
            });
        };

        const fileKey = `audioFile_${recordFilename}`;
        saveFileToLocalStorage(recording.blob, fileKey);

        return sendRecording(1);
    }

    sendRecording(channelId, rootId) {
        if (!this.channelId && !channelId) {
            return Promise.reject(new Error('channel id is required'));
        }
        const cId = this.channelId ? this.channelId : channelId;
        const rId = !this.channelId && rootId ? rootId : this.rootId;
        // console.log('client: send recording');
        if (this._recording) {
            return this._sendRecording({
                channelId: cId,
                rootId: rId,
                recording: this._recording,
            });
        }
        return this.recorder.stop().then((res) => {
            return this._sendRecording({
                channelId: cId,
                rootId: rId,
                recording: res,
            });
        });
    }

    on(type, cb) {
        if (type === 'update') {
            this._onUpdate = cb;
        }
    }
}
