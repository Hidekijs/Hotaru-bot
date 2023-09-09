import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

global.owner = {
	"number": "5492615112937",
	"name": "メ HIDEKI メ"
};
global.bot = {
	"name": "⛩️ʜᴏᴛᴀʀᴜ | ʙᴏᴛ⛩️",
	"image": ""
};

global.mods = ['5493572542901', '5493572571050'];

global.fake = `*_${bot.name} by ${owner.name}_*`
global.prefix = ['!', '-', '+', '.'];
global.react = {
	wait: '⏳',
	global: '✨',
	error: '❌'
};

global.name_sessions = 'Sessions|Bot'
global.metadata = {
	"reload": true
}

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