import "../config.js";
import { parsePhoneNumber } from 'libphonenumber-js';


const updateParticipants = async(sock, { id, participants, action }) => {
	try {
		const delay = async timeout => { return new Promise( (resolve) => setTimeout(resolve, timeout) ) }
		const reply = async(text, options = {}) => {
			let p = [1, 0]
			p = p[Math.floor(Math.random() * p.length)];
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
		let id1 = participants[0]
		let id2 = participants[1] || null

		if (isAntifake && action == 'add') {
			let Number = parsePhoneNumber('+' + id1.replace('@s.whatsapp.net'));
			let isFake = dataFake?.some(fake => Number.number.startsWith(fake));
			if (isFake) {
				await reply('*⛩️ Lo siento su prefijo esta vetado de este grupo asique sera eliminado @' + Number.number.slice(1).trim()  + '.*');
				await delay(2500);
				await sock.groupParticipantsUpdate(id, [id1], 'remove');
				await delay(2500);
				await await sock.updateBlockStatus(id1, "block");
			};
		};

		switch(action) {

			case 'add':{
				if (isAntifake) await FakeFunction(id1);
				if (isWelcome) {
					let Welcome = db.data.chats[id]?.customWel;
					let res = Welcome.replace('@user', '@' + id1.split`@`[0]).replace('@group', await sock.getName(id));
					await m.reply(res.trim());
				}
			};
			break;

			case 'remove':{

			};
			break;

			case 'promote':{

			};
			break;

			case 'demote':{

			};
			break;
		}
	} catch(e) {
		console.log(e);
	};
};

export { updateParticipants };