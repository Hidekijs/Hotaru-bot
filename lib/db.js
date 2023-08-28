const dataBase = async(sock, m, db) => {
	try{
		let isBlock = Object.values(await sock.fetchBlocklist()).includes(m.sender);
		let code = await sock.groupInviteCode(m.from).catch(_ => null);
		let isNumber = v => typeof v == 'number' && !isNaN(v)
		let isBoolean = v => typeof v == 'boolean' && Boolean(v)

		if (isBlock) return;

		if (m.isGroup && (m.from.endsWith('@g.us'))) {
			let chat = db.data.chats[m.from];
			if (typeof chat != 'object') db.data.chats[m.from] = {};

			if (chat) {
				if (!('name' in chat)) chat.name = await sock.getName(m.from) || sock.chats[m.from].subject
				if (!('code' in chat)) chat.code = m.isBotAdmin ? code : null;
				if (!isBoolean(chat.mute)) chat.mute = false;
				if (!isBoolean(chat.notify)) chat.notify = false;
				if (!isBoolean(chat.welcome)) chat.welcome = false;
				if (!isBoolean(chat.badword)) chat.badword = false;
				if (!isBoolean(chat.antione)) chat.antione = false;
				if (!isBoolean(chat.antileg)) chat.antileg = false;
				if (!isBoolean(chat.antilink)) chat.antilink = false;
				if (!isBoolean(chat.antifake)) chat.antifake = false;
				if (!isBoolean(chat.antidelete)) chat.antidelete = false;
				if (typeof chat.link != 'object') chat.link = [];
				if (typeof chat.fake != 'object') chat.fake = [];
				if (typeof chat.badlist != 'object') chat.badlist = [];
			} else {
				db.data.chats[m.from] = {
					name: await sock.getName(m.from),
					code: m.isBotAdmin ? code : null,
					mute: false,
					notify: false,
					welcome: false,
					badword: false,
					antione: false,
					antileg: false,
					antilink: false,
					antifake: false,
					antidelete: false,
					link: [],
					fake: [],
					badlist: []
				}
			};
		};

		let bot = db.data.settings[sock.user.jid];
		if (typeof bot != 'object') db.data.settings[sock.user.jid] = {};
		
		if (bot) {
			if (!('name' in bot)) bot.name = sock.user.name || await sock.getName(sock.user.jid)
			if (!isBoolean(bot.public)) bot.public = true
			if (!isBoolean(bot.private)) bot.private = false
			if (!isBoolean(bot.autobio)) bot.autobio = false
			if (!isBoolean(bot.autorestart)) bot.autorestart = false
			if (!isNumber(bot.bioTime)) bot.bioTime = 0
			if (typeof bot.hit != 'object') bot.hit = []
		} else {
			db.data.settings[sock.user.jid] = {
				name: sock.user.name || await sock.getName(sock.user.jid),
				public: true,
				private: false,
				autobio: false,
				autorestart: false,
				bioTime: 0,
				hit: []
			};
		};

	} catch(e) {
		console.log(e)
	}
}

export { dataBase };