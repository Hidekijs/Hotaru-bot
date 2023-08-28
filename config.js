import { Low } from 'lowdb';
import baileys from 'baileys';
import { JSONFile } from 'lowdb/node';
import { updateMessages } from './update/messages-upsert.js';
import { updateParticipants } from './update/participants-update.js';

global.owner = {
	"number": "5492615112937",
	"name": "メ HIDEKI メ"
};
global.bot = {
	"name": "⛩️ʜᴏᴛᴀʀᴜ | ʙᴏᴛ⛩️",
	"image": ""
};
global.icon = {
	mode: true,
	emoji: '⛩️'
}
global.fake = `*_${bot.name} by ${owner.name}_*`
global.prefix = ['!', '-', '+', '.'];
global.react = {
	wait: '⏳',
	global: '✨',
	error: '❌'
};
global.name_sessions = 'Sessions|Bot'

global.mess = (m, mess) => {
	let message = {
		admin: icon.mode ? `*${icon.emoji} Shhhh vos no sos admin asique no toque lo que no sabe*` : '*Shhhh vos no sos admin asique no toque lo que no sabe*',
		botAdmin: icon.mode ? `*${icon.emoji} Pero si no me das admin como pensas que lo voy a sacar soy un bot no mago we*` : '*Pero si no me das admin como pensas que lo voy a sacar soy un bot no mago we*',
		noQuery: icon.mode ? `*${icon.emoji} Huy si mira como saco el aire del grupo. Marca a quien queres que saque con @ o menciona el mensaje*` : '*Huy si mira como saco el aire del grupo. Marca a quien queres que saque con @ o menciona el mensaje*',
		isAdmin: icon.mode ? `*${icon.emoji} Que pedo yo no voy a sacar a otro admin hacelo vos, es como si golpearas a tu abuela en la cara*` : '*Que pedo yo no voy a sacar a otro admin hacelo vos, es como si golpearas a tu abuela en la cara*',
		isMe: icon.mode ? `*${icon.emoji} Como me voy a saca a mi mismo babos@ eso no se puede hacelo vos manualmente*` : '*Como me voy a saca a mi mismo babos@ eso no se puede hacelo vos manualmente*'
	}[mess]

	if (message) return m.reply(message)
}

global.baileys = baileys;
global.updateMessages = updateMessages;
global.updateParticipants = updateParticipants;

global.db = new Low(new JSONFile('db.json'), {
	chats: {},
	users: {},
	settings: {}
});

if (global.db.data == null) await global.db.read(); else await global.db.read();

if (global.db && typeof global.db.data == 'object') {
	setInterval(async () => {
		if (global.db.data) await global.db.write();
	}, 30 * 1000);
};