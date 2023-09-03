import "../config.js";
import baileys, {
	jidDecode,
	makeWASocket,
	getContentType,
	areJidsSameUser,
	jidNormalizedUser,
	downloadContentFromMessage
} from "baileys";

const { 
	proto
} = baileys;

import { parsePhoneNumber } from 'libphonenumber-js';

export async function makeWAClient (args) {
	let sock = Object.defineProperties(makeWASocket(args), {
		parseMention: {
			value (text) {
				return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net');
			},
			enumerable: true
		},
		decodeJid: {
			value (jid) {
				if (!jid) return jid;
				if (/:\d+@/gi.test(jid)) {
					let decode = jidDecode(jid) || {}
					return decode.user && decode.server && decode.user + '@' + decode.server || jid
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
		getAdmins: {
			async value (from) {
				try{
					if (!from && !from.endsWith('@g.us')) return;
					let admins = new Array();
					let { participants } = await store.groupMetadata[from] || await(await sock.groupFetchAllParticipating)[from];
					for (let i of participants) {
						if (i.admin != null) admins.push(i.id);
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
							thumbnailUrl: options.image ? options.image : ""
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
		serealizeStubType: {
			async value (m) {
				if(!m) return;
				try{
					if (!M?.messageStubType && M?.key?.fromMe) return;
					let id = sock.decodeJid(m.key.remoteJid || m.message?.senderKeyDistributionMessage?.groupId || '');
					if (!id || id == 'status@broadcast') return;

					///PARTICIPANTS UPDATE///
					if (m.messageStubType == WAMessageStubType.GROUP_PARTICIPANT_ADD) return sock.ev.emit("participants.update", { sock, id: id, participants: [...m.messageStubParameters, m.participant], action: 'add' });
					if (m.messageStubType == WAMessageStubType.GROUP_PARTICIPANT_REMOVE) return sock.ev.emit("participants.update", { sock, id: id, participants: [...m.messageStubParameters, m.participant], action: 'remove' });
					if (m.messageStubType == WAMessageStubType.GROUP_PARTICIPANT_PROMOTE) return sock.ev.emit("participants.update", { sock, id: id, participants: [...m.messageStubParameters, m.participant], action: 'promote' });
					if (m.messageStubType == WAMessageStubType.GROUP_PARTICIPANT_DEMOTE) return sock.ev.emit("participants.update", { sock, id: id, participants: [...m.messageStubParameters, m.participant], action: 'demote' });

					///GROUPS CHANGE///
					if (m.messageStubType == WAMessageStubType.GROUP_CHANGE_ICON) return sock.ev.emit('group.update', { id: id, participant: m.participant, change: 'icon', protocol: m.messageStubParameters[0] });
					if (m.messageStubType == WAMessageStubType.GROUP_CHANGE_SUBJECT) return sock.ev.emit('group.update', { id: id, participant: m.participant, change: 'subject', protocol: m.messageStubParameters[0] })
					if (m.messageStubType == WAMessageStubType.GROUP_CHANGE_ANNOUNCE) return sock.ev.emit('group.update', { id: id, participant: m.participant, change: 'announce', protocol: m.messageStubParameters[0] })
					if (m.messageStubType == WAMessageStubType.GROUP_CHANGE_RESTRICT) return sock.ev.emit('group.update', { id: id, participant: m.participant, change: 'restrict', protocol: m.messageStubParameters[0] })
					if (m.messageStubType == WAMessageStubType.GROUP_CHANGE_INVITE_LINK) return sock.ev.emit('group.update', { id: id, participant: m.participant, change: 'invite_link', protocol: m.messageStubParameters[0] })
				} catch(e) {
					console.log
				}
			},
			enumerable: true
		},
		serealizeMessage: {
			async value (m) {

				if (!m) return;
				
				let Proto = proto.WebMessageInfo.fromObject;
				
				m = m.messages[0];

				if (m.key.remoteJid == "status@broadcast" || m.broadcast || !m.message) return;

				if (m.messageStubType && m.type == "append") return;
				
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
					m.isAdmin = m.isGroup ? Object.values(await sock.getAdmins(m.from)).includes(m.sender) : false;
					m.isBotAdmin = m.isGroup ? Object.values(await sock.getAdmins(m.from)).includes(sock.user.jid) : false;
					m.isOwner = m.isMe || (m.number == owner.number);
				}

				if (m.message) {
					m.type = Object.keys(m.message)[0]
					m.msg = m.message[m.type];
					m.isMedia = ["webp", "video", "audio", "image"].some(type => m.msg?.mimetype?.includes(type));
					m.body = ((m.type == "conversation") && m.msg) || ((m.type == "extendedTextMessage") && m.msg.text) || ((m.type == "imageMessage") && m.msg.caption) || ((m.type == "videoMessage") && m.msg.caption) || ((m.type == "documentMessage") && m.msg.caption) || "";
					m.bodyLink = (/https:|www.|.com|.org/gi.test(m.body) && m.body.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/, "gi"))) || "";
					m.prefix = m.body && m.body[0] || prefix[0];
					m.isCmd = prefix.some(prefix => m.body.startsWith(prefix));
					m.command = (m.isCmd) && m.body.slice(1).split(/ +/).shift().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";
					m.args = (m.isCmd && m.command) && m.body.trim().split(/ +/).slice(1) || m.body.trim().split(/ +/);
					m.text = m.args.join(" ");
					
					let quotedMention = m.msg?.contextInfo != null ? m.msg?.contextInfo.participant : ''
					let tagMention = m.msg?.contextInfo != undefined ? m.msg?.contextInfo.mentionedJid : []
					let mention = typeof(tagMention) == 'string' ? [tagMention] : tagMention
					mention != undefined ? mention.push(quotedMention) : []
					
					m.mentionedJid = mention != undefined ? mention.filter(x => x) : []
					m.delay = async timeout => { return new Promise((resolve) => setTimeout(resolve, timeout)) };
					m.delete = () => sock.sendMessage(m.from, { delete: m.key });
					m.react = emoji => sock.sendMessage(m.from, { react: { text: emoji, key: m.key }});
					m.download = async(filename, save) => await sock.downloadMediaMessage(m, filename, save);

					let quotedMessage = m.quoted = m.msg.contextInfo?.quotedMessage ? 
					Proto({
						key: {
							remoteJid: m.from || m.key.remoteJid,
							fromMe: (m.msg.contextInfo.participant == sock.user.jid),
							id: m.msg.contextInfo.stanzaId,
							participant: m.msg.contextInfo.participant
						},
						message: m.msg.contextInfo.quotedMessage
					}) : false

					if (m.quoted) {
						if (m.quoted.key) {
							m.quoted.id = m.quoted.key.id;
							m.quoted.isBot = (m.quoted.id.startsWith("3EB0") && m.quoted.id.length == 12) || (m.quoted.id.startsWith("BAE5") && m.quoted.id.length == 16);
							m.quoted.isMe = m.quoted.key.fromMe;
							m.quoted.sender = jidNormalizedUser(m.quoted.key.participant || m.quoted.key.remoteJid);
							m.quoted.number = m.quoted.sender.replace("@s.whatsapp.net", "");
							m.quoted.pushName = await sock.getName(m.quoted.sender);
							m.quoted.isAdmin = [...await sock.getAdmins(m.from)].includes(m.quoted.sender);
							m.quoted.isOwner = m.quoted.isMe || (m.quoted.number == owner.number);
						}

						m.quoted.message = (Object.keys(m.quoted.message) == "ephemeralMessage") ? m.quoted.message["ephemeralMessage"].message : (Object.keys(m.quoted.message) == "viewOnceMessageV2") ? m.quoted.message["viewOnceMessageV2"].message : (Object.keys(m.quoted.message) == "documentWithCaptionMessage") ? m.quoted.message["documentWithCaptionMessage"].message : (Object.keys(m.quoted.message) == "ptvMessage") ? { videoMessage: m.quoted.message["ptvMessage"] } : m.quoted.message;

						if (m.quoted.message) {
							m.quoted.type = Object.keys(m.quoted.message);
							m.quoted.msg = m.quoted.message[m.quoted.type];
							m.quoted.isMedia = ["webp", "video", "audio", "image"].some(type => m.quoted.msg?.mimetype?.includes(type));
							m.quoted.body = (m.quoted.type == "conversation") ? m.quoted.msg : (m.quoted.type == "extendedTextMessage") ? m.quoted.msg.text : ((m.quoted.type == "imageMessage") || (m.quoted.type == "videoMessage") || (m.quoted.type == "documentMessage")) ? m.quoted.msg.caption : "";
							m.quoted.bodyLink = (/https:|www./gi.test(m.quoted.body)) ? m.quoted.body.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/, "gi")) : "";
							m.quoted.prefix = m.quoted.msg ? m.quoted.body[0] : prefix[0];
							m.quoted.isCmd = prefix.some(prefix => m.quoted.body.startsWith(prefix));
							m.quoted.command = m.quoted.isCmd ? m.quoted.body.slice(1).split(/ +/).shift().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
							m.quoted.args = (m.quoted.command && m.quoted.isCmd) ? m.quoted.body.trim().split(/ +/).slice(1) : m.quoted.body.trim().split(/ +/);
							m.quoted.text = m.quoted.args.join(" ");

							m.quoted.delete = () => sock.sendMessage(m.from, { delete: m.quoted.key });
							m.quoted.react = emoji => sock.sendMessage(m.from, { react: { text: emoji, key: m.quoted.key }});
							m.quoted.download = async(filename, save) => await sock.downloadMediaMessage(m.quoted, filename, save);
						}
					}
				};

				m.reply = async(text, options = {}) => {
					let p = [1, 0]
					p = p[Math.floor(Math.random() * p.length)];
					await sock.sendPresenceUpdate('composing', m.from);
					await m.delay(1500);
					return await sock.sendMessage(options.id ? options.id : m.from, {
						text: text,
						contextInfo: {
							mentionedJid: options.mentions ? options.mentions : sock.parseMention(text),
							externalAdReply: {
								renderLargerThumbnail: options.render ? options.render : false,
								showAdAttribution: options.adAttrib ? options.adAttrib : false,
								title: (p == 1) ? '⛩️¡Seguínos en instagram!⛩️' : '⛩️¡Seguínos en Facebook!⛩️',
								body: options.body ? options.body : await sock.getName(m.from),
								mediaType: 1,
								thumbnailUrl: options.img ? options.img : 'https://telegra.ph/file/7c88adc390f833300232f.jpg',
								sourceUrl: (p == 1) ? 'https://instagram.com/hotaru.ofc?igshid=NzZhOTFlYzFmZQ==' : 'https://www.facebook.com/Somoshotaru?mibextid=ZbWKwL'
							}
						}
					});
				};

				return sock.ev.emit("serealize.message", {sock, m, store});
			},
			enumerable: true
		}
	});

	return sock;
};

/*const Client = (sock, store) => {
	sock.chats = {};

	sock.parseMention = (text) => {
		return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net');
	};

	sock.serealizeStubType = async(M) => {
		if (!M) return;
		try{
			if (!M?.messageStubType && M?.key?.fromMe) return;
			let id = sock.decodeJid(m.key.remoteJid || m.message?.senderKeyDistributionMessage?.groupId || '');
			if (!id || id == 'status@broadcast') return;

			///PARTICIPANTS UPDATE///
			if (m.messageStubType == WAMessageStubType.GROUP_PARTICIPANT_ADD) return await updateParticipants(sock, { id: id, participants: [...m.messageStubParameters, m.participant], action: 'add' });
			if (m.messageStubType == WAMessageStubType.GROUP_PARTICIPANT_REMOVE) return await updateParticipants(sock, { id: id, participants: [...m.messageStubParameters, m.participant], action: 'remove' });
			if (m.messageStubType == WAMessageStubType.GROUP_PARTICIPANT_PROMOTE) return await updateParticipants(sock, { id: id, participants: [...m.messageStubParameters, m.participant], action: 'promote' });
			if (m.messageStubType == WAMessageStubType.GROUP_PARTICIPANT_DEMOTE) return await updateParticipants(sock, { id: id, participants: [...m.messageStubParameters, m.participant], action: 'demote' });

			///GROUPS CHANGE///
			if (m.messageStubType == WAMessageStubType.GROUP_CHANGE_ICON) return sock.ev.emit('group.update', { id: id, participant: m.participant, change: 'icon', protocol: m.messageStubParameters[0] });
			if (m.messageStubType == WAMessageStubType.GROUP_CHANGE_SUBJECT) return sock.ev.emit('group.update', { id: id, participant: m.participant, change: 'subject', protocol: m.messageStubParameters[0] })
			if (m.messageStubType == WAMessageStubType.GROUP_CHANGE_ANNOUNCE) return sock.ev.emit('group.update', { id: id, participant: m.participant, change: 'announce', protocol: m.messageStubParameters[0] })
			if (m.messageStubType == WAMessageStubType.GROUP_CHANGE_RESTRICT) return sock.ev.emit('group.update', { id: id, participant: m.participant, change: 'restrict', protocol: m.messageStubParameters[0] })
			if (m.messageStubType == WAMessageStubType.GROUP_CHANGE_INVITE_LINK) return sock.ev.emit('group.update', { id: id, participant: m.participant, change: 'invite_link', protocol: m.messageStubParameters[0] })
		} catch(error) {
			console.log(error);
		};
	};

	sock.serealizeM =  async(Message) => {
		if(!Message) return;

		let Proto = proto.WebMessageInfo.fromObject;

		let getMessageType = (message) => {
			let type = Object.keys(message);
			return (!['senderKeyDistributionMessage', 'messageContextInfo'].includes(type[0]) && type[0]) || (type.length >= 3 && type[1] !== 'messageContextInfo' && type[1]) || type[type.length - 1] || Object.keys(message)[0]
		};

		let M = Message.messages[0];

		if (m.messageStubType) return await sock.serealizeStubType(M);

		if(m.key.remotedJid == 'status@broadcast' || m.broadcast || !m.message) return;

		m.message = (getMessageType(m.message) == 'viewOnceMessageV2' && m.message.viewOnceMessageV2.message || getMessageType(m.message) == 'documentWithCaptionMessage' && m.message.documentWithCaptionMessage.message || getMessageType(m.message) == 'ptvMessage' && { videoMessage: m.message.ptvMessage } || getMessageType(m.message) == 'ephemeralMessage' && m.message.ephemeralMessage.message || m.message);

		if (m.message.senderKeyDistributionMessage) delete m.message.senderKeyDistributionMessage
		if (m.message.messageContextInfo) delete m.message.messageContextInfo

		if (m.key) {
			m.id = m.key.id
			m.isBaileys = (m.id.startsWith('3EB0') && m.id.length == 12) || (m.id.startsWith('BAE5') && m.id.length == 16)
			m.from = m.key.remoteJid
			m.isMe = m.key.fromMe
			m.isGroup = m.from.endsWith('@g.us')
			m.isPrivate = m.from.endsWith('@s.whatsapp.net')
			m.sender = jidNormalizedUser(m.key.participant || m.key.remoteJid)
			m.senderNumber = m.sender.replace('@s.whatsapp.net', '') || m.sender.split('@')[0]
			m.isOwner = m.isMe || (m.senderNumber == owner.number) || global.mod.includes(m.senderNumber);
			m.pushName = m.pushName || await sock.getName(m.sender) || store.contacts[m.sender]?.name
			m.isAdmin = m.isGroup ? Object.values(await sock.getAdmins(m.from)).includes(m.sender) : undefined
			m.isBotAdmin = m.isGroup ? Object.values(await sock.getAdmins(m.from)).includes(sock.user.jid) : undefined
			m.delay = async timeout => { return new Promise( (resolve) => setTimeout(resolve, timeout) ) }
			m.data = id => db.data.chats[id] || db.data.users[id] || db.data.bot[id] || {}
		};

		if (m.message) {
			m.type = getMessageType(m.message);
			m.msg = m.message[m.type];
			m.isMedia = m.msg?.mimetype ? /audio|image|video|gif/.test(m.msg.mimetype) : false
			m.body = ((m.type == 'conversation') && m.msg) || ((m.type == 'extendedTextMessage') && m.msg.text) || ((m.type == 'imageMessage') && m.msg.caption) || ((m.type == 'videoMessage') && m.msg.caption) || ((m.type == 'buttonsResponseMessage') && m.msg.selectedButtonId) || ((m.type == 'listResponseMessage') && m.msg.singleSelectReply) || ((m.type == 'documentMessage') && m.msg.caption) || ''
			m.bodyUrl = /https:|www.|.com|.org/gi.test(m.body) ? (m.body.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/, 'gi')) || false) : false
			m.prefix = m.body ? m.body[0] : false
			m.isCmd = prefix.some(prefix => m.body.startsWith(prefix));
			m.command = m.isCmd ? m.body.slice(1).trim().split(/ +/).shift().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : ''
			m.args = (m.isCmd && m.command) ? m.body.trim().split(/ +/).slice(1) : m.body.trim().split(/ +/).slice(0);
			m.text = m.args.join(' ');

			let quotedMention = m.msg?.contextInfo != null ? m.msg.contextInfo?.participant : ''
			let tagMention = m.msg?.contextInfo != undefined ? m.msg.contextInfo?.mentionedJid : []
			let mention = typeof(tagMention) == 'string' ? [tagMention] : tagMention
			mention != undefined ? mention.push(quotedMention) : []
				
			m.mentionUser = mention != undefined ? mention.filter(x => x) : []
			m.delete = () => sock.sendMessage(m.from, { delete: m.key });
			m.react = emoji => sock.sendMessage(m.from, { react: { text: emoji, key: m.key } });
			m.download = (filename = 'undefined', save = false) => sock.downloadMediaMessage(M, filename, save);
			let quoted = m.quoted = m.msg?.contextInfo?.quotedMessage ? Proto({
				key: {
					remoteJid: m.from,
					fromMe: (m.msg.contextInfo.participant == jidNormalizedUser(sock.user.id)),
					id: m.msg.contextInfo.stanzaId,
					participant: m.msg.contextInfo.participant
				},
				message: m.msg.contextInfo.quotedMessage
			}) : false

			if (m.quoted) {
				m.quoted.message = (getMessageType(m.quoted.message) == 'viewOnceMessageV2' && m.quoted.message.viewOnceMessageV2.message || getMessageType(m.quoted.message) == 'documentWithCaptionMessage' && m.quoted.message.documentWithCaptionMessage.message || getMessageType(m.quoted.message) == 'ptvMessage' && { videoMessage: m.quoted.message.ptvMessage } || getMessageType(m.quoted.message) == 'ephemeralMessage' && m.quoted.message.ephemeralMessage.message || m.quoted.message);
				if (m.quoted.key) {
					m.quoted.id = m.quoted.key.id;
					m.quoted.isMe = m.quoted.key.fromMe;
					m.quoted.isBaileys = (m.quoted.id.startsWith('3EB0') && m.quoted.id.length == 12) || (m.quoted.id.startsWith('BAE5') && m.quoted.id.length == 16);
					m.quoted.sender = jidNormalizedUser(m.quoted.key.participant);
					m.quoted.senderNumber = m.quoted.sender.replace('@s.whatsapp.net', '') || m.quoted.sender.split('@')[0];
					m.quoted.pushName = await sock.getName(m.quoted.sender) || store.contacts[m.quoted.sender]?.name
					m.quoted.isOwner = m.quoted.isMe || (m.quoted.senderNumber == owner.number) || global.mod.includes(m.quoted.senderNumber);
					m.quoted.isAdmin = m.isGroup ? Object.values(await sock.getAdmins(m.from)).includes(m.quoted.sender) : false
				};
				
				if (m.quoted.message) {
					m.quoted.type = getMessageType(m.quoted.message);
					m.quoted.msg = m.quoted.message[m.quoted.type];
					m.quoted.isMedia = m.quoted.msg?.mimetype ? /audio|video|gif|image/.test(m.quoted.msg.mimetype) : false
					m.quoted.body = ((m.quoted.type == 'conversation') && m.quoted.msg) || ((m.quoted.type == 'extendedTextMessage') && m.quoted.msg.text) || ((m.quoted.type == 'imageMessage') && m.quoted.msg.caption) || ((m.quoted.type == 'videoMessage') && m.quoted.msg.caption) || ((m.quoted.type == 'buttonsResponseMessage') && m.quoted.msg.selectedButtonId) || ((m.quoted.type == 'listResponseMessage') && m.msg.singleSelectReply) || ((m.quoted.type == 'documentMessage') && m.quoted.msg.caption) || ''
					m.quoted.bodyUrl = /https:|www.|.com|.org/gi.test(m.quoted.body) ? (m.quoted.body.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/, 'gi')) || false) : false
					m.quoted.prefix = m.quoted.msg[0];
					m.quoted.isCmd = global.prefix.some(prefix => m.quoted.body.startsWith(prefix));
					m.quoted.command = m.quoted.isCmd ? m.quoted.body.slice(1).trim().split(/ +/).shift().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : ''
					m.quoted.args = (m.quoted.isCmd && m.quoted.command) ? m.quoted.body.trim().split(/ +/).slice(2) : m.quoted.body.trim().split(/ +/).slice(0);
					m.quoted.text = m.quoted.args.join(' ');
				};

				m.quoted.delete = () => sock.sendMessage(m.from, { delete: m.quoted.key });
				m.quoted.react = emoji => sock.sendMessage(m.from, { react: { text: emoji, key: m.quoted.key }});
				m.quoted.download = (filename = 'undefined.pdf', save = false) => sock.downloadMediaMessage(m.quoted, filename, save)
			};
		};

		m.reply = async(text, options = {}) => {
			let p = [1, 0]
			p = p[Math.floor(Math.random() * p.length)];
			await sock.sendPresenceUpdate('composing', m.from);
			await m.delay(1500);
			return await sock.sendMessage(options.id ? options.id : m.from, {
				text: text,
				contextInfo: {
					mentionedJid: options.mentions ? options.mentions : sock.parseMention(text),
					externalAdReply: {
						renderLargerThumbnail: options.render ? options.render : false,
						showAdAttribution: options.adAttrib ? options.adAttrib : false,
						title: (p == 1) ? '⛩️¡Seguínos en instagram!⛩️' : '⛩️¡Seguínos en Facebook!⛩️',
						body: options.body ? options.body : await sock.getName(m.from),
						mediaType: 1,
						thumbnailUrl: options.img ? options.img : 'https://telegra.ph/file/7c88adc390f833300232f.jpg',
						sourceUrl: (p == 1) ? 'https://instagram.com/hotaru.ofc?igshid=NzZhOTFlYzFmZQ==' : 'https://www.facebook.com/Somoshotaru?mibextid=ZbWKwL'
					}
				}
			});
		};

		m.replyStik = async(path, options = { quoted: (m.isGroup) ? false : M }) => {
			return await sock.sendMessage(options.id ? options.id : m.from, {
				sticker: path,
				contextInfo: {
					mentionedJid: options.mentions ? options.mentions : [m.sender],
					remoteJid: options.quoted ? null : (m.isGroup ? m.from : null),
					externalAdReply: options.adReply ? {
						renderLargerThumbnail: false,
						showAdAttribution: false,
						title: 'Stickers proveidos por ' + bot.name,
						body: 'Dessarrollado por ' + owner.name,
						thumbnailUrl: db.bot.img,
						url: options.url ? options.url : gpLink
					} : null
					}
			}, {
				quoted: options.quoted ? options.quoted : null
			});
		};

		m.replyAud = async(path, options = {}) => {
			return await sock.sendMessage(options.id ? options.id : m.from, {
				audio: path,
				ptt: options.ptt ? options.ptt : false,
				mimetype: options.ptt ? 'audio/ogg; codecs=opus' : 'audio/mpeg',
				contextInfo: {
					mentionedJid: options.mentions ? options.mentions : [m.sender],
					remoteJid: options.quoted ? null : (m.isGroup ? m.from : null),
					externalAdReply: options.adReply ? {
						renderLargerThumbnail: false,
						showAdAttribution: false,
						title: 'Audios proveidos por ' + bot.name,
						body: 'Dessarrollado por ' + owner.name,
						thumbnailUrl: db.bot.img,
						url: options.url ? options.url : gpLink
					} : null
				}
			}, {
				quoted: options.quoted ? options.quoted : null
			})
		};

		m.replyImg = async(path, caption = '', options = { quoted: (m.isGroup) ? false : M }) => {
			return await sock.sendMessage(options.id ? options.id : m.from, {
				image: path,
				caption: caption,
				contextInfo: {
					mentionedJid: options.mentions ? options.mentions : [m.sender],
					remoteJid: options.quoted ? null : (m.isGroup ? m.from : null),
					externalAdReply: options.adReply ? {
						renderLargerThumbnail: false,
						showAdAttribution: false,
						title: 'Imagenes proveidas por ' + bot.name,
						body: 'Dessarrollado por ' + owner.name,
						mediaType: 1,
						thumbnailUrl: db.bot.img,
						url: options.url ? options.url : gpLink
					} : null
				}
			}, {
				quoted: options.quoted ? options.quoted : null
			})
		};

		m.replyVid = async(path, caption = '', options = { quoted: (m.isGroup) ? false : M }) => {
			return await sock.sendMessage(options.id ? options.id : m.from, {
				video: path,
				caption: caption,
				gifPlayback: options.gif ? options.gif : false,
				contextInfo: {
					mentionedJid: options.mentions ? options.mentions : [m.sender],
					remoteJid: options.quoted ? null : (m.isGroup ? m.from : null),
					externalAdReply: options.adReply ? {
						renderLargerThumbnail: false,
						showAdAttribution: false,
						title: 'Videos proveidos por ' + bot.name,
						body: 'Dessarrollado por ' + owner.name,
						mediaType: 1,
						thumbnailUrl: db.bot.img,
						url: options.url ? options.url : gpLink
					} : null
				}
			}, {
				quoted: options.quoted ? options.quoted : null
			});
		};

		m.replyDoc = async(path, caption = '', options = { quoted: (m.isGroup) ? false : M }) => {
			return await sock.sendMessage(options.id ? options.id : m.from, {
				document: path,
				caption: caption,
				mimetype: options.mime ? options.mime : 'application/pdf',
				fileName: options.filename ? options.filename : 'undefined.pdf',
				contextInfo: {
					remoteJid: options.mentions ? options.mentions : [m.sender],
					remoteJid: options.quoted ? null : (m.isGroup ? m.from : null),
					externalAdReply: options.adReply ? {
						renderLargerThumbnail: false,
						showAdAttribution: false,
						title: 'Documentos proveidos por ' + bot.name,
						body: 'Dessarrollado por ' + owner.name,
						mediaType: 1,
						thumbnailUrl: db.bot.img,
						url: options.url ? options.url : gpLink
					} : null
				}
			}, {
				quoted: options.quoted ? options.quoted : null
			});
		};

		if (sock.self && !m.isOwner) return;
		
		return updateMessages(sock, M, store);
	};

	sock.decodeJid = (jid) => {
		if (!jid) return jid;
		if (/:\d+@/gi.test(jid)) {
			let decode = jidDecode(jid) || {}
			return decode.user && decode.server && decode.user + '@' + decode.server || jid
		} else return jid
	};

	sock.downloadMediaMessage = async(m, filename, save) => {
		let message = m.msg ? m.msg : m
		let mime = (m.msg || m).mimetype || ''
		let messageType = m.type ? m.type.replace(/Message/gi, '') : mime.split`/`[0]
		let stream = await downloadContentFromMessage(message, messageType);
		let buffer = Buffer.from([]);
		for await(let chunk of stream) {
			buffer = Buffer.concat([buffer, chunk]);
		};

		if (save) {
			let type = await FileType.fromBuffer(buffer);
			let Filename = filename ? filename + '.' + type.ext : 'undefined.' + type.ext
			await fs.writeFileSync(Filename, buffer);
			return Filename;
		};
		return buffer;
	};

	sock.resizeImg = async(image, width, height) => {
		let pic = await jimp.read(image);
		let resize = await pic.resize(width, height).getBufferAsync(jimp.MIME_JPEG);
		return resize;
	};

	sock.getAdmins = async(from) => {
		if(!from && !from.endsWith('@g.us')) return;
		let { participants } = db.data.metadata[from];
		let admins = [];
		for(let x of participants) {
			if (/admin|superadmin/.test(x.admin)) admins.push(x.id);
		}
		return admins.map(v => v);
	};

	sock.getName = (jid) => {
		return new Promise(async(resolve, reject) => {
			if (!jid) return;
			let id = sock.decodeJid(jid);
			let format = parsePhoneNumber('+' + id.replace('@s.whatsapp.net'));
			let v;
			if (id.endsWith('@g.us')) {
				v = sock.chats[id] || await sock.groupMetadata(id).catch(_ => { subject: id });
				resolve(v.subject || v.id);
			} else v = (id == '0@s.whatsapp.net') ? { id, name: 'Whatsapp'} : areJidsSameUser(id, sock.user.id) ? { id, name: sock.user.name } : store.contacts[id] ? store.contacts[id] : { id, name: 'undefined' }
			resolve(v.name || v.verifedName || format.number.international);
		});
	};

	sock.metaData = () => {
		return new Promise(async(resolve, reject) => {
			try{
				let Groups = await sock.groupFetchAllParticipating().catch(_ => [{}]);
				for(let chat in Groups) db.data.metadata[Groups[chat].id] = {
					...(db.data.metadata[chat] || {}),
					...(Groups[chat] || {}),
					code: db.data.chats[Groups[chat].id]?.code || await sock.groupInviteCode(Groups[chat].id).catch(_ => _) || null
				};
				resolve(db.data.metadata);
			} catch(e) {
				console.log(e);
				reject(e);
			}
		});
	}

	if (sock.user?.id) sock.user.jid = sock.decodeJid(sock.user.id);

	return sock;
}

export { Client };*/