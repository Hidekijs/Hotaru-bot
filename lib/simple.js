import "../config.js";
import baileys, {
	jidDecode,
	makeWASocket,
	getContentType,
	areJidsSameUser,
	jidNormalizedUser,
	WAMessageStubType,
	downloadContentFromMessage
} from "baileys";

const { 
	proto
} = baileys;

import fs from "fs";
import P from "pino";
import FileType from "file-type";
import { parsePhoneNumber } from "libphonenumber-js";

import { byteToSize } from "./functions.js";

export function makeWAClient(args, options = { }) {
	const sock = Object.defineProperties(makeWASocket(args), {
		parseMention: {
			value (text) {
				return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + "@s.whatsapp.net");
			},
			enumerable: true
		},
		decodeJid: {
			value (jid) {
				if (!jid) return jid;
				if (/:\d+@/gi.test(jid)) {
					let decode = jidDecode(jid) || {}
					return decode.user && decode.server && decode.user + "@" + decode.server || jid
				} else return jid
			},
			enumerable: true
		},
		getMessageType: {
			value (m) {
				let Type = Object.keys(m);
				if (!["senderKeyDistributionMessage", "messageContextInfo"].includes(Type[0])) { return Type[0]; }
				else if (Type.length >= 3 && Type[1] != "messageContextInfo") { return Type[1]; }
				else Type[Type.length - 1] || Object.keys(m)[0];
			},
			enumerable: true
		},
		getName: {
			value (jid) {
				return new Promise(async(resolve, reject) => {
					if (!jid) return;
					let id = sock.decodeJid(jid);
					let format = parsePhoneNumber(`+ ${id.replace("@s.whatsapp.net")}`);
					let v;
					if (id.endsWith("@g.us")) {
						v = store.groupMetadata[id] || await sock.groupMetadata(id).catch(_ => { subject: id });
						resolve(v.subject || v.id);
					} else v = (id == "0@s.whatsapp.net") ? { id, name: "Whatsapp"} : areJidsSameUser(id, sock.user.id) ? { id, name: sock.user.name } : store.contacts[id] ? store.contacts[id] : { id, name: "NPC" }
					resolve(v.name || v.verifedName || format.number);
				});
			},
			enumerable: true
		},
		serealizeStubType: {
			async value (m) {
				if (!m) return;
				try{
					if (!m?.messageStubType && m?.key?.fromMe) return;
					let id = sock.decodeJid(m.key.remoteJid || m.message?.senderKeyDistributionMessage?.groupId || "");
					if (!id || id == "status@broadcast") return;

					///PARTICIPANTS UPDATE///
					if (m.messageStubType == WAMessageStubType.GROUP_PARTICIPANT_ADD) return sock.ev.emit("participants.update", { sock, id: id, participants: [...m.messageStubParameters, m.participant], action: "add" });
					if (m.messageStubType == WAMessageStubType.GROUP_PARTICIPANT_REMOVE) return sock.ev.emit("participants.update", { sock, id: id, participants: [...m.messageStubParameters, m.participant], action: "remove" });
					if (m.messageStubType == WAMessageStubType.GROUP_PARTICIPANT_PROMOTE) return sock.ev.emit("participants.update", { sock, id: id, participants: [...m.messageStubParameters, m.participant], action: "promote" });
					if (m.messageStubType == WAMessageStubType.GROUP_PARTICIPANT_DEMOTE) return sock.ev.emit("participants.update", { sock, id: id, participants: [...m.messageStubParameters, m.participant], action: "demote" });

					///GROUPS CHANGE///
					if (m.messageStubType == WAMessageStubType.GROUP_CHANGE_ICON) return sock.ev.emit("group.update", { id: id, participant: m.participant, change: "icon", protocol: m.messageStubParameters[0] });
					if (m.messageStubType == WAMessageStubType.GROUP_CHANGE_SUBJECT) return sock.ev.emit("group.update", { id: id, participant: m.participant, change: "subject", protocol: m.messageStubParameters[0] })
					if (m.messageStubType == WAMessageStubType.GROUP_CHANGE_ANNOUNCE) return sock.ev.emit("group.update", { id: id, participant: m.participant, change: "announce", protocol: m.messageStubParameters[0] })
					if (m.messageStubType == WAMessageStubType.GROUP_CHANGE_RESTRICT) return sock.ev.emit("group.update", { id: id, participant: m.participant, change: "restrict", protocol: m.messageStubParameters[0] })
					if (m.messageStubType == WAMessageStubType.GROUP_CHANGE_INVITE_LINK) return sock.ev.emit("group.update", { id: id, participant: m.participant, change: "invite_link", protocol: m.messageStubParameters[0] })
				} catch(error) {
					console.log(error);
				};
			},
			enumerable: true
		},
		getAdmins: {
			async value (from) {
				try{
					if (!from && !from.endsWith("@g.us")) return;
					let admins = new Array();
					let { participants } = await store.groupMetadata[from] || await(await sock.groupFetchAllParticipating)[from];
					for (let i of participants) {
						if (/admin|superadmin/.test(i.admin)) admins.push(i.id);
					}
					return admins.map(i => i);
				} catch(e) {
					return [];
				}
			},
			enumerable: true
		},
		getMetadata: {
			async get () {
				let chats = await sock.groupFetchAllParticipating().catch(_ => null) || {};
				
				let chat = Object.keys(chats).map(i => i);
				
				for(let i in chats) store.groupMetadata[i] = {
					...(store.groupMetadata[i] || {}),
					...(chats[i] || {}),
					code: await sock.groupInviteCode(i).catch(_ => null) || "No es admin el bot"
				};

				Object.keys(store.groupMetadata).forEach((i) => {
					if (!chat.includes(i)) delete store.groupMetadata[i];
				});
			},
			enumerable: true
		},
		sendText: {
			async value (from, text = "", options = { }) {
				return await sock.sendMessage(from, {
					text: text,
					contextInfo: {
						remoteJid: options.remote ? options.remote : null,
						mentionedJid: options.mentions ? options.mentions : sock.parseMention(text),
						externalAdReply: options.ads ? {
							renderLargerThumbnail: options.render ? options.render : null,
							showAdAttribution: options.adAttrib ? options.adAttrib : null,
							title: options.title ? options.title : "",
							body: options.body ? options.body : "",
							mediaType: 1,
							thumbnailUrl: options.image ? options.image : "",
							sourceUrl: options.url ? options.url : null
						} : null
					}
				}, {
					quoted: options.quoted ? options.quoted : null
				});
			},
			enumerable: true
		},
		sendMedia: {
			async value (from, path, options = { }) {
				let type;
				let buffer;
				let Size;
				if (Buffer.isBuffer(path)) { buffer = path } else await fetch(path).then(async(response) => {
					let data = await response.arrayBuffer();
					buffer = Buffer.from(data);
					Size = data.byteLength;
				})
				let { ext, mime } = await FileType.fromBuffer(buffer);
				let size = byteToSize(Size);
				if (options.document) type = "document";
				else if(options.sticker || mime.split("/")[1] == "webp") type = "sticker";
				else if(/image/.test(mime)) type = "image";
				else if(/video/.test(mime)) type = "video";
				else if(/audio/.test(mime)) type = "audio";
				else if (size.split(" MB") >= 99.00) type = "document";
				else type = "document";

				return await sock.sendMessage(from, {
					[type]: buffer,
					caption: options.caption ? options.caption : null,
					ptt: (options.ptt && type == "audio") ? options.ptt : null,
					gifPlayback: (type == "video" && options.gif) ? options.gif : null,
					mimetype: options.mime ? options.mime : mime,
				}, {
					quoted: options.quoted ? options.quoted : null
				});
			},
			enumerable: true
		},
		serealizeMessage: {
			async value (m) {

				if (!m) return;
				
				let Proto = proto.WebMessageInfo.fromObject;
				m = m.messages[0];

				if (m?.messageStubType) return sock.serealizeStubType(m);

				if (m.key.remoteJid == "status@broadcast" || m.broadcast || !m.message) return;
				
				m.message = (Object.keys(m.message)[0] == "ephemeralMessage") ? m.message["ephemeralMessage"].message : (Object.keys(m.message)[0] == "viewOnceMessageV2") ? m.message["viewOnceMessageV2"].message : (Object.keys(m.message)[0] == "documentWithCaptionMessage") ? m.message["documentWithCaptionMessage"].message : (Object.keys(m.message)[0] == "ptvMessage") ? { videoMessage: m.message["ptvMessage"] } : m.message;
				
				if (m.message.senderKeyDistributionMessage) delete m.message.senderKeyDistributionMessage;
				if (m.message.messageContextInfo) delete m.message.messageContextInfo;
				
				if (m.key) {
					m.id = m.key.id;
					m.isBot = (m.id.startsWith("3EB0") && m.id.length == 12) || (m.id.startsWith("BAE5") && m.id.length == 16);
					m.from = m.key.remoteJid;
					m.isMe = m.key.fromMe;
					m.isGroup = m.from.endsWith("@g.us");
					m.isChat = m.from.endsWith("@s.whatsapp.net");
					m.sender = jidNormalizedUser(m.key.participant || m.key.remoteJid);
					m.number = m.sender.replace("@s.whatsapp.net", "");
					m.pushName = m.pushName || "Sin Nombre";
					m.isOwner = m.isMe || (m.number === owner.number) || mods.some(i => i === m.number);
					if (m.isGroup) {
						m.metadata = await sock.groupMetadata(m.from);
						m.admins = m.metadata.participants.filter(i => i.admin == "admin" || i.admin == "superadmin").map(i => i.id);
						m.isAdmin = m.admins.includes(m.sender);
						m.isBotAdmin = m.admins.includes(sock.user.jid);
					}
				};

				if (m.message) {
					m.type = Object.keys(m.message)[0];
					m.msg = m.message[m.type];
					m.isViewOnce = m?.msg?.viewOnce;
					m.isMedia = ["image", "sticker", "video", "audio"].some(i => i == m.type.replace("Message", ""));
					m.body = (m.type == "conversation") ? m.msg : (m.type == "extendedTextMessage") ? m.msg.text : (m.type == "imageMessage") ? m.msg.caption : (m.type == "videoMessage") ? m.msg.caption : (m.type == "documentMessage") ? m.msg?.caption : "";
					m.isCmd = prefix.some(i => m.body.startsWith(i));
					m.command = m.isCmd ? m.body.slice(1).trim().split(/ +/).shift().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : false
					m.args = (m.isCmd && m.command) ? m.body.trim().split(/ +/).splice(1) : m.body.trim().split(/ +/);
					m.text = m.args.join(" ");

					let quotedMention = m.msg?.contextInfo != null ? m.msg.contextInfo?.participant : ''
					let tagMention = m.msg?.contextInfo != undefined ? m.msg.contextInfo?.mentionedJid : []
					let mention = typeof(tagMention) == 'string' ? [tagMention] : tagMention
					mention != undefined ? mention.push(quotedMention) : []

					m.mentionedJid = mention != undefined ? mention.filter(x => x) : []
					m.delete = () => sock.sendMessage(m.from, { delete: m.key });
					m.react = emoji => sock.sendMessage(m.from, { react: { text: emoji, key: m.key }});
					m.download = async(filename, save) => await sock.downloadMediaMessage(m, filename, save);

					m.quoted = (m.msg?.contextInfo && Object.keys(m.msg.contextInfo).some(i => i == "quotedMessage")) ?
					Proto({
						key: {
							remoteJid: m.from || m.key.remoteJid,
							fromMe: (m.msg.contextInfo.participant == sock.user.jid),
							id: m.msg.contextInfo.stanzaId,
							participant: m.msg.contextInfo.participant
						},
						message: m.msg.contextInfo.quotedMessage
					}) : false;

					if (m.quoted) {
						if (m.quoted.key) {
							m.quoted.id = m.quoted.key.id;
							m.quoted.isBot = (m.quoted.id.startsWith("3EB0") && m.quoted.id.length == 12) || (m.quoted.id.startsWith("BAE5") && m.quoted.id.length == 16);
							m.quoted.isMe = m.quoted.key.fromMe;
							m.quoted.sender = jidNormalizedUser(m.quoted.key.participant || m.quoted.key.remoteJid);
							m.quoted.number = m.quoted.sender.replace("@s.whatsapp.net", "");
							m.quoted.isOwner = m.quoted.isMe || (m.quoted.number == owner.number) || mods.some(i => i == m.quoted.number);
							m.quoted.isAdmin = m.admins.includes(m.quoted.sender);
						};
						
						m.quoted.message = (Object.keys(m.quoted.message)[0] == "ephemeralMessage") ? m.quoted.message["ephemeralMessage"].message : (Object.keys(m.quoted.message)[0] == "viewOnceMessageV2") ? m.quoted.message["viewOnceMessageV2"].message : (Object.keys(m.quoted.message)[0] == "documentWithCaptionMessage") ? m.quoted.message["documentWithCaptionMessage"].message : (Object.keys(m.quoted.message)[0] == "ptvMessage") ? { videoMessage: m.quoted.message["ptvMessage"] } : m.quoted.message;

						if (m.quoted.message) {

							m.quoted.type = Object.keys(m.quoted.message)[0];
							m.quoted.msg = m.quoted.message[m.quoted.type];
							m.quoted.isViewOnce = m?.quoted?.msg?.viewOnce;
							m.quoted.isMedia = ["image", "sticker", "video", "audio"].some(i => i == m.quoted.type.replace("Message", ""));
							m.quoted.body = (m.quoted.type == "conversation") ? m.quoted.msg : (m.quoted.type == "extendedTextMessage") ? m.quoted.msg.text : (m.quoted.type == "imageMessage") ? m.quoted.msg.caption : (m.quoted.type == "videoMessage") ? m.quoted.msg.caption : (m.quoted.type == "documentMessage") ? m.quoted.msg.caption : "";
							m.quoted.isCmd = prefix.some(i => m.quoted.body.startsWith(i));
							m.quoted.command = m.quoted.isCmd ? m.quoted.body.slice(1).trim().split(/ +/).shift().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : false;
							m.quoted.args = (m.quoted.isCmd && m.quoted.command) ? m.quoted.body.trim().split(/ +/).splice(2) : m.quoted.body.trim().split(/ +/);
							m.quoted.text = m.quoted.args.join(" ");
						};

						m.quoted.delete = () => sock.sendMessage(m.from, { delete: m.quoted.key });
						m.quoted.react = emoji => sock.sendMessage(m.from, { react: { text: emoji, key: m.quoted.key }})
						m.quoted.download = async(filename, save) => await sock.downloadMediaMessage(m.quoted, filename, save);
					};
				};

				m.reply = async(text, options = {}) => {
					let p = [1, 0]
					p = p[Math.floor(Math.random() * p.length)];
					return await sock.sendMessage(options.id ? options.id : m.from, {
						text: text,
						contextInfo: {
							mentionedJid: options.mentions ? options.mentions : sock.parseMention(text),
							externalAdReply: {
								renderLargerThumbnail: options.render ? options.render : false,
								showAdAttribution: options.adAttrib ? options.adAttrib : false,
								title: (p == 1) ? "⛩️¡Seguínos en instagram!⛩️" : "⛩️¡Seguínos en Facebook!⛩️",
								body: options.body ? options.body : await sock.getName(m.from),
								mediaType: 1,
								thumbnailUrl: options.img ? options.img : "https://telegra.ph/file/7c88adc390f833300232f.jpg",
								sourceUrl: (p == 1) ? "https://instagram.com/hotaru.ofc?igshid=NzZhOTFlYzFmZQ==" : "https://www.facebook.com/Somoshotaru?mibextid=ZbWKwL"
							}
						}
					});
				};

				return sock.ev.emit("serealize.message", {sock, m, store});
			},
			enumerable: true
		}
	});
	
	if (sock.user?.id) sock.user.jid = jidNormalizedUser(sock.user.id);

	return sock;
};