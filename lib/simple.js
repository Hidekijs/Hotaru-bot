import "../config.js";
const {
	proto,
	jidDecode,
	areJidsSameUser,
	jidNormalizedUser,
	downloadContentFromMessage,
	WAMessageStubType
} = baileys;

import { parsePhoneNumber } from 'libphonenumber-js';

const Client = (sock, store) => {
	sock.chats = {};

	sock.parseMention = (text) => {
		return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net');
	};

	sock.serealizeStubType = async(M) => {
		if (!M) return;
		try{
			if (!M?.messageStubType && M?.key?.fromMe) return;
			let id = sock.decodeJid(M.key.remoteJid || M.message?.senderKeyDistributionMessage?.groupId || '');
			if (!id || id == 'status@broadcast') return;

			///PARTICIPANTS UPDATE///
			if (M.messageStubType == WAMessageStubType.GROUP_PARTICIPANT_ADD) return await updateParticipants(sock, { id: id, participants: [...M.messageStubParameters, M.participant], action: 'add' });
			if (M.messageStubType == WAMessageStubType.GROUP_PARTICIPANT_REMOVE) return await updateParticipants(sock, { id: id, participants: [...M.messageStubParameters, M.participant], action: 'remove' });
			if (M.messageStubType == WAMessageStubType.GROUP_PARTICIPANT_PROMOTE) return await updateParticipants(sock, { id: id, participants: [...M.messageStubParameters, M.participant], action: 'promote' });
			if (M.messageStubType == WAMessageStubType.GROUP_PARTICIPANT_DEMOTE) return await updateParticipants(sock, { id: id, participants: [...M.messageStubParameters, M.participant], action: 'demote' });

			///GROUPS CHANGE///
			if (M.messageStubType == WAMessageStubType.GROUP_CHANGE_ICON) return sock.ev.emit('group.update', { id: id, participant: M.participant, change: 'icon', protocol: M.messageStubParameters[0] });
			if (M.messageStubType == WAMessageStubType.GROUP_CHANGE_SUBJECT) return sock.ev.emit('group.update', { id: id, participant: M.participant, change: 'subject', protocol: M.messageStubParameters[0] })
			if (M.messageStubType == WAMessageStubType.GROUP_CHANGE_ANNOUNCE) return sock.ev.emit('group.update', { id: id, participant: M.participant, change: 'announce', protocol: M.messageStubParameters[0] })
			if (M.messageStubType == WAMessageStubType.GROUP_CHANGE_RESTRICT) return sock.ev.emit('group.update', { id: id, participant: M.participant, change: 'restrict', protocol: M.messageStubParameters[0] })
			if (M.messageStubType == WAMessageStubType.GROUP_CHANGE_INVITE_LINK) return sock.ev.emit('group.update', { id: id, participant: M.participant, change: 'invite_link', protocol: M.messageStubParameters[0] })
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

		if (M.messageStubType) return await sock.serealizeStubType(M);

		if(M.key.remotedJid == 'status@broadcast' || M.broadcast || !M.message) return;

		M.message = (getMessageType(M.message) == 'viewOnceMessageV2' && M.message.viewOnceMessageV2.message || getMessageType(M.message) == 'documentWithCaptionMessage' && M.message.documentWithCaptionMessage.message || getMessageType(M.message) == 'ptvMessage' && { videoMessage: M.message.ptvMessage } || getMessageType(M.message) == 'ephemeralMessage' && M.message.ephemeralMessage.message || M.message);

		if (M.message.senderKeyDistributionMessage) delete M.message.senderKeyDistributionMessage
		if (M.message.messageContextInfo) delete M.message.messageContextInfo

		if (M.key) {
			M.id = M.key.id
			M.isBaileys = (M.id.startsWith('3EB0') && M.id.length == 12) || (M.id.startsWith('BAE5') && M.id.length == 16)
			M.from = M.key.remoteJid
			M.isMe = M.key.fromMe
			M.isGroup = M.from.endsWith('@g.us')
			M.isPrivate = M.from.endsWith('@s.whatsapp.net')
			M.sender = jidNormalizedUser(M.key.participant || M.key.remoteJid)
			M.senderNumber = M.sender.replace('@s.whatsapp.net', '') || M.sender.split('@')[0]
			M.isOwner = M.isMe || (M.senderNumber == owner.number) || global.mod.includes(M.senderNumber);
			M.pushName = M.pushName || await sock.getName(M.sender) || store.contacts[M.sender]?.name
			M.isAdmin = M.isGroup ? Object.values(await sock.getAdmins(M.from)).includes(M.sender) : undefined
			M.isBotAdmin = M.isGroup ? Object.values(await sock.getAdmins(M.from)).includes(sock.user.jid) : undefined
			M.delay = async timeout => { return new Promise( (resolve) => setTimeout(resolve, timeout) ) }
			M.data = id => db.data.chats[id] || db.data.users[id] || db.data.bot[id] || {}
		};

		if (M.message) {
			M.type = getMessageType(M.message);
			M.msg = M.message[M.type];
			M.isMedia = M.msg?.mimetype ? /audio|image|video|gif/.test(M.msg.mimetype) : false
			M.body = ((M.type == 'conversation') && M.msg) || ((M.type == 'extendedTextMessage') && M.msg.text) || ((M.type == 'imageMessage') && M.msg.caption) || ((M.type == 'videoMessage') && M.msg.caption) || ((M.type == 'buttonsResponseMessage') && M.msg.selectedButtonId) || ((M.type == 'listResponseMessage') && M.msg.singleSelectReply) || ((M.type == 'documentMessage') && M.msg.caption) || ''
			M.bodyUrl = /https:|www.|.com|.org/gi.test(M.body) ? (M.body.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/, 'gi')) || false) : false
			M.prefix = M.body ? M.body[0] : false
			M.isCmd = prefix.some(prefix => M.body.startsWith(prefix));
			M.command = M.isCmd ? M.body.slice(1).trim().split(/ +/).shift().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : ''
			M.args = (M.isCmd && M.command) ? M.body.trim().split(/ +/).slice(1) : M.body.trim().split(/ +/).slice(0);
			M.text = M.args.join(' ');

			let quotedMention = M.msg?.contextInfo != null ? M.msg.contextInfo?.participant : ''
			let tagMention = M.msg?.contextInfo != undefined ? M.msg.contextInfo?.mentionedJid : []
			let mention = typeof(tagMention) == 'string' ? [tagMention] : tagMention
			mention != undefined ? mention.push(quotedMention) : []
				
			M.mentionUser = mention != undefined ? mention.filter(x => x) : []
			M.delete = () => sock.sendMessage(M.from, { delete: M.key });
			M.react = emoji => sock.sendMessage(M.from, { react: { text: emoji, key: M.key } });
			M.download = (filename = 'undefined', save = false) => sock.downloadMediaMessage(M, filename, save);
			let quoted = M.quoted = M.msg?.contextInfo?.quotedMessage ? Proto({
				key: {
					remoteJid: M.from,
					fromMe: (M.msg.contextInfo.participant == jidNormalizedUser(sock.user.id)),
					id: M.msg.contextInfo.stanzaId,
					participant: M.msg.contextInfo.participant
				},
				message: M.msg.contextInfo.quotedMessage
			}) : false

			if (M.quoted) {
				M.quoted.message = (getMessageType(M.quoted.message) == 'viewOnceMessageV2' && M.quoted.message.viewOnceMessageV2.message || getMessageType(M.quoted.message) == 'documentWithCaptionMessage' && M.quoted.message.documentWithCaptionMessage.message || getMessageType(M.quoted.message) == 'ptvMessage' && { videoMessage: M.quoted.message.ptvMessage } || getMessageType(M.quoted.message) == 'ephemeralMessage' && M.quoted.message.ephemeralMessage.message || M.quoted.message);
				if (M.quoted.key) {
					M.quoted.id = M.quoted.key.id;
					M.quoted.isMe = M.quoted.key.fromMe;
					M.quoted.isBaileys = (M.quoted.id.startsWith('3EB0') && M.quoted.id.length == 12) || (M.quoted.id.startsWith('BAE5') && M.quoted.id.length == 16);
					M.quoted.sender = jidNormalizedUser(M.quoted.key.participant);
					M.quoted.senderNumber = M.quoted.sender.replace('@s.whatsapp.net', '') || M.quoted.sender.split('@')[0];
					M.quoted.pushName = await sock.getName(M.quoted.sender) || store.contacts[M.quoted.sender]?.name
					M.quoted.isOwner = M.quoted.isMe || (M.quoted.senderNumber == owner.number) || global.mod.includes(M.quoted.senderNumber);
					M.quoted.isAdmin = M.isGroup ? Object.values(await sock.getAdmins(M.from)).includes(M.quoted.sender) : false
				};
				
				if (M.quoted.message) {
					M.quoted.type = getMessageType(M.quoted.message);
					M.quoted.msg = M.quoted.message[M.quoted.type];
					M.quoted.isMedia = M.quoted.msg?.mimetype ? /audio|video|gif|image/.test(M.quoted.msg.mimetype) : false
					M.quoted.body = ((M.quoted.type == 'conversation') && M.quoted.msg) || ((M.quoted.type == 'extendedTextMessage') && M.quoted.msg.text) || ((M.quoted.type == 'imageMessage') && M.quoted.msg.caption) || ((M.quoted.type == 'videoMessage') && M.quoted.msg.caption) || ((M.quoted.type == 'buttonsResponseMessage') && M.quoted.msg.selectedButtonId) || ((M.quoted.type == 'listResponseMessage') && M.msg.singleSelectReply) || ((M.quoted.type == 'documentMessage') && M.quoted.msg.caption) || ''
					M.quoted.bodyUrl = /https:|www.|.com|.org/gi.test(M.quoted.body) ? (M.quoted.body.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/, 'gi')) || false) : false
					M.quoted.prefix = M.quoted.msg[0];
					M.quoted.isCmd = global.prefix.some(prefix => M.quoted.body.startsWith(prefix));
					M.quoted.command = M.quoted.isCmd ? M.quoted.body.slice(1).trim().split(/ +/).shift().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : ''
					M.quoted.args = (M.quoted.isCmd && M.quoted.command) ? M.quoted.body.trim().split(/ +/).slice(2) : M.quoted.body.trim().split(/ +/).slice(0);
					M.quoted.text = M.quoted.args.join(' ');
				};

				M.quoted.delete = () => sock.sendMessage(M.from, { delete: M.quoted.key });
				M.quoted.react = emoji => sock.sendMessage(M.from, { react: { text: emoji, key: M.quoted.key }});
				M.quoted.download = (filename = 'undefined.pdf', save = false) => sock.downloadMediaMessage(M.quoted, filename, save)
			};
		};

		M.reply = async(text, options = {}) => {
			let p = [1, 0]
			p = p[Math.floor(Math.random() * p.length)];
			return await sock.sendMessage(options.id ? options.id : M.from, {
				text: text,
				contextInfo: {
					mentionedJid: options.mentions ? options.mentions : sock.parseMention(text),
					externalAdReply: {
						renderLargerThumbnail: options.render ? options.render : false,
						showAdAttribution: options.adAttrib ? options.adAttrib : false,
						title: (p == 1) ? '⛩️¡Seguínos en instagram!⛩️' : '⛩️¡Seguínos en Facebook!⛩️',
						body: options.body ? options.body : await sock.getName(M.from),
						mediaType: 1,
						thumbnailUrl: options.img ? options.img : 'https://telegra.ph/file/7c88adc390f833300232f.jpg',
						sourceUrl: (p == 1) ? 'https://instagram.com/hotaru.ofc?igshid=NzZhOTFlYzFmZQ==' : 'https://www.facebook.com/Somoshotaru?mibextid=ZbWKwL'
					}
				}
			});
		};

		M.replyStik = async(path, options = { quoted: (M.isGroup) ? false : M }) => {
			return await sock.sendMessage(options.id ? options.id : M.from, {
				sticker: path,
				contextInfo: {
					mentionedJid: options.mentions ? options.mentions : [M.sender],
					remoteJid: options.quoted ? null : (M.isGroup ? M.from : null),
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

		M.replyAud = async(path, options = {}) => {
			return await sock.sendMessage(options.id ? options.id : M.from, {
				audio: path,
				ptt: options.ptt ? options.ptt : false,
				mimetype: options.ptt ? 'audio/ogg; codecs=opus' : 'audio/mpeg',
				contextInfo: {
					mentionedJid: options.mentions ? options.mentions : [M.sender],
					remoteJid: options.quoted ? null : (M.isGroup ? M.from : null),
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

		M.replyImg = async(path, caption = '', options = { quoted: (M.isGroup) ? false : M }) => {
			return await sock.sendMessage(options.id ? options.id : M.from, {
				image: path,
				caption: caption,
				contextInfo: {
					mentionedJid: options.mentions ? options.mentions : [M.sender],
					remoteJid: options.quoted ? null : (M.isGroup ? M.from : null),
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

		M.replyVid = async(path, caption = '', options = { quoted: (M.isGroup) ? false : M }) => {
			return await sock.sendMessage(options.id ? options.id : M.from, {
				video: path,
				caption: caption,
				gifPlayback: options.gif ? options.gif : false,
				contextInfo: {
					mentionedJid: options.mentions ? options.mentions : [M.sender],
					remoteJid: options.quoted ? null : (M.isGroup ? M.from : null),
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

		M.replyDoc = async(path, caption = '', options = { quoted: (M.isGroup) ? false : M }) => {
			return await sock.sendMessage(options.id ? options.id : M.from, {
				document: path,
				caption: caption,
				mimetype: options.mime ? options.mime : 'application/pdf',
				fileName: options.filename ? options.filename : 'undefined.pdf',
				contextInfo: {
					remoteJid: options.mentions ? options.mentions : [M.sender],
					remoteJid: options.quoted ? null : (M.isGroup ? M.from : null),
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
		let { participants } = sock.chats[from] || await sock.groupMetadata(from).catch(_ => { participants: [{ id: '0@s.whatsapp.net', admin: null }] })
		let admins = [];
		for(let x of participants) {
			if (x.admin == 'admin' || x.admin == 'superadmin') admins.push(x.id)
		}
		return admins;
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
					code: db.data.chats[chat].code || await sock.groupInviteCode(Groups[chat].id).catch(_ => _) || null
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

export { Client };