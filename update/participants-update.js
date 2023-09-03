import "../config.js";
import { parsePhoneNumber } from 'libphonenumber-js';


const updateParticipants = async({sock, id, participants, action }) => {
	try {
		console.log({sock, id, participants, action })
		const delay = async timeout => { return new Promise( (resolve) => setTimeout(resolve, timeout) ) }
		const reply = async(text, options = {}) => {
			let p = [1, 0]
			p = p[Math.floor(Math.random() * p.length)];
			await sock.sendPresenceUpdate('composing', id);
			await delay(1500);
			return await sock.sendMessage(options.id ? options.id : id, {
				text: text,
				contextInfo: {
					mentionedJid: options.mentions ? options.mentions : sock.parseMention(text),
					externalAdReply: {
						renderLargerThumbnail: options.render ? options.render : false,
						showAdAttribution: options.adAttrib ? options.adAttrib : false,
						title: (p == 1) ? '⛩️¡Seguínos en instagram!⛩️' : '⛩️¡Seguínos en Facebook!⛩️',
						body: options.body ? options.body : await sock.getName(id),
						mediaType: 1,
						thumbnailUrl: options.img ? options.img : 'https://telegra.ph/file/7c88adc390f833300232f.jpg',
						sourceUrl: (p == 1) ? 'https://instagram.com/hotaru.ofc?igshid=NzZhOTFlYzFmZQ==' : 'https://www.facebook.com/Somoshotaru?mibextid=ZbWKwL'
					}
				}
			});
		};

		let isWelcome = db.data?.chats[id]?.welcome;
		let isAntifake = db.data?.chats[id]?.antifake;
		let dataFake = db.data?.chats[id]?.fake;
		let meta = store.groupMetadata[id];
		let sender = participants[0];
		let sender2 = participants[1] || null

		if (isAntifake) {
			let idNumber = '+' + sender.split('@')[0]
			let isFake = dataFake.some(cmd => idNumber.startsWith(cmd));
			if (isFake && action == 'add') {
				await reply('*⛩️ Lo siento su prefijo esta vetado de este grupo asique sera eliminado @' + sender.split('@')[0]  + '.*');
				await delay(2500);
				await sock.groupParticipantsUpdate(id, [sender], 'remove');
				await delay(2500);
				return await sock.updateBlockStatus(sender, "block");
			};
		};

		switch(action) {

			case 'add':{
				if (isWelcome) {
					let Welcome = db.data.chats[id]?.customWel;
					let teks = Welcome.replace('@user', '@' + sender.split`@`[0]).replace('@group', await sock.getName(id)).replace('@desc', meta.desc);
					await reply(teks.trim());
				};
			};
			break;

			case 'remove':{
				if (isWelcome){
					if (sender2 == sock.user.jid) return;
					let Bye = db.data.chats[id]?.customBye;
					let teks = Bye.replace('@user', `@${sender.split('@')[0]}`).replace('@group', await sock.getName(id)).replace('@desc', meta.desc);
					await reply(teks.trim());
				};
			};
			break;

			case 'promote':{
				if (sender2 == sock.user.jid) return;
				let promote = `*⛩️ Nuevo Usuario Promovido ⛩️*\n\n*Usuario:* @${sender.split('@')[0]}\n*Promovido por:* @${sender2.split('@')[0]}\n\n@${sender.split('@')[0]} *Usted fue añadido al grupo de administradores a partir de ahora.*`;
				await reply(promote.trim(), { mentions: meta.participants.filter(i => i.admin == 'admin' || i.admin == 'superadmin').map(i => i.id) });
			};
			break;

			case 'demote':{
				if (sender2 == sock.user.jid) return;
				let demote = `*⛩️ Nuevo Usuario Degradado ⛩️*\n\n*Usuario:* @${sender.split('@')[0]}\n*Degradado por:* @${sender2.split('@')[0]}\n\n@${sender.split('@')[0]} *Usted a dejado de pertenecer al grupo de admins a partir de ahora.*`;
				await reply(demote.trim(), { mentions: meta.participants.filter(i => i.admin == 'admin' || i.admin == 'superadmin').map(i => i.id) });
			};
			break;
		}
	} catch(e) {
		console.log(e);
	};
};

export { updateParticipants };