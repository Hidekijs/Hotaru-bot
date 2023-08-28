import "../config.js";
import { format } from 'util';
import { exec } from 'child_process';
import syntaxErr from 'syntax-error';
import { dataBase } from '../lib/db.js';
import { getAdmins } from '../lib/functions.js';

const updateMessages = async(sock, m, store) => {
	try {
		let v = m.quoted ? m.quoted : m;

		await dataBase(sock, m, db);

		let metadata = sock.chats[m.from] ? sock.chats[m.from] : await sock.groupMetadata(m.from).catch(_ => {});
		let groupAdmins = await getAdmins(metadata.participants);

		///[ BASE DE DATOS ]///
		let isAntilink = m.data(m.from)?.antilink || db.data.chats[m.from]?.antilink
		let isAntifake = m.data(m.from)?.antifake || db.data.chats[m.from]?.antifake
		let isBadWord = m.data(m.from)?.badword || db.data.chats[m.from]?.badword
		let isMute = m.data(m.from)?.mute || db.data.chats[m.from]?.mute

		if (isAntilink) {
			let code = m.data(m.from).code || db.data.chats[m.from].code;
			let body = m.body.trim().toLowerCase();
			let isLink = db.data.chats[m.from].link.some(letter => body.includes(letter));
			if (isLink) {
				if (m.body.includes('https://chat.whatsapp.com/' + code)) return m.react('🧐');
				if (m.fromMe) return;
				if (m.isOwner) return;
				if (m.isAdmin) return m.react('🫠');
				await sock.groupParticipantsUpdate(m.from, [m.sender], 'remove');
				await m.delay(1500);
				await m.delete();
				await m.reply('*⛩️ Su mensaje contiene un link prohibido fue eliminado su mensaje junto con el remitente*', { adreply: true });
				await m.delay(1500);
				await m.reply('*⛩️ Bye bye spam*', { adreply: true });
			};
		};

		switch (m.command) {

			case 'kick':
			case 'pafuera':
			case 'eliminar': {
				if (!m.isBotAdmin) return m.reply('*⛩️ No se puede usar esta funcion si no soy administrador.*');
				if (!m.isAdmin) return m.reply('*⛩️ Esta funcion es solo para los administradores.*');
				if (!m.mentionUser) return m.reply('*⛩️ Marque un mensaje o use @ para elejir a quien eliminar.*');
				let user = m.mentionUser && m.mentionUser[0] || m.quoted.sender;
				if (sock.user.jid == user) return m.reply('*⛩️ No puedo autoeliminarme.*');
				if (groupAdmins.includes(user)) return m.reply('*⛩️ Mis permisos no me permiten eliminar a otro administrador.*');
				if (user == m.sender) return m.reply('*⛩️ No puedes autoeliminarte.*')
				await sock.groupParticipantsUpdate(m.from, [user], 'remove');
				await m.reply('*⛩️ El usuario @' + user.split`@`[0] + ' ya no forma parte del grupo.*');
				await m.react('⛩️');
			}
			break;

			case 'antilink':{
				if (!m.isBotAdmin) return m.reply('*⛩️ No se puede usar esta funcion si no soy administrador.*');
				if (!m.isAdmin) return m.reply('*⛩️ Esta funcion es solo para los administradores.*');
				if (!m.mentionUser && !m.quoted) return m.reply('*⛩️ Marque un mensaje o use @ para elejir a quien eliminar.*');
				if (/true|activar|on/.test(m.args[0])) {
					if (isAntilink) return m.reply('*⛩️ Esta funcion esta activa en este grupo.*');
					m.data(m.from).antilink = true;
					await m.reply('*⛩️ Se activo el antilink correctamente. Para agregar links use addlink o de lo contrario use delink.*');
					await m.react('⛩️');
				} else if (/false|desactivar|off/.test(m.args[0])) {
					if (!isAntilink) return m.reply('*⛩️ Esta funcion esta desactivada en este grupo.*');
					m.data(m.from).antilink = false;
					await m.reply('*⛩️ La funcion antilinks se desactivo.*');
					await m.react('⛩️');
				} else m.reply('*⛩️ Utilice on/off para interactuar con esta funcion.*');
 			};
			break;

			case 'addlink':
			case 'delink': {
				if (!m.isBotAdmin) return m.reply('*⛩️ No se puede usar esta funcion si no soy administrador.*');
				if (!m.isAdmin) return m.reply('*⛩️ Esta funcion es solo para los administradores.*');
				if (!isAntilink) return m.reply('*⛩️ La funcion antilink esta desactivada sin esa funcion activa esto no puede funcionar.*');
				if (!m.text) return m.reply('*⛩️ No se registro ningun link. Use ' + m.prefix + m.command + ' https://link*');
				let link = m.text.startsWith('https://') ? m.text : 'https://' + m.text;
				let data = m.data(m.from)?.link || db.data.chats[m.from]?.link
				if (m.command == 'addlink') {
					if (data.includes(link)) return m.reply('*⛩️ Este elemento ya se encuentra en la lista.*');
					data.push(link);
					await m.reply('*⛩️ Se agrego ' + link + ' a la lista de url`s prohibidas.*');
					await m.react('⛩️');
				} else if (m.command == 'delink') {
					if (!data.includes(link)) return m.reply('*⛩️ Este elemento no se encuentra en la lista.*');
					let posi = data.indexOf(link);
					data.splice(posi, 1);
					await m.reply('*⛩️ Se elimino ' + link + ' de la lista de url`s prohibidas.*');
					await m.react('⛩️');
				};
			};
			break;

			case 'antifake':
			case 'fake': {
				if (!m.isBotAdmin) return m.reply('*⛩️ No se puede usar esta funcion si no soy administrador.*');
				if (!m.isAdmin) return m.reply('*⛩️ Esta funcion es solo para los administradores.*');
				if (/on|true|activar/.test(m.args[0])) {
					if (isAntifake) return m.reply('*⛩️ Esta funcion esta activa en este grupo.*');
					m.data(m.from).antifake = true;
					await m.reply('*⛩️ Se activo el antifake. Ingrese los numero o prefijos con addfake o elimine con delfake.*');
					await m.react('⛩️');
				} else if(/off|false|desactivar/.test(m.args[0])) {
					if (!isAntifake) return m.reply('*⛩️ Esta funcion esta desactivada en este grupo.*');
					m.data(m.from).antifake = false;
					await m.reply('*⛩️ Se desactivo el antifake. El filtro de numeros dejara ingresar culquier numero.*');
					await m.react('⛩️');
				} else m.reply('*⛩️ Utlice activar o desactivar para interactuar con esta funcion.*');
			};
			break;

			case 'addfake':
			case 'delfake':
			case 'fakelist':{
				if (!m.isBotAdmin) return m.reply('*⛩️ No se puede usar esta funcion si no soy administrador.*');
				if (!m.isAdmin) return m.reply('*⛩️ Esta funcion es solo para los administradores.*');
				if (!isAntifake) return m.reply('*⛩️ La funcion antifake debe encontrarse activa para utilizar estos elementos.*');
				if (!m.text) return m.reply('*⛩️ Ingrese un prefijo que desea anular al ingresar a este grupo.*');
				let numero = m.text.startsWith('+') ? m.text : '+' + m.text;
				let data = m.data(m.from)?.fake || db.data.chats[m.from]?.fake;
				if ('addfake' == m.command) {
					if (data.includes(numero)) return m.reply('*⛩️ Este prefijo se encuentra en la lista.*');
					data.push(numero);
					await m.reply('*⛩️ Se agrego ' + numero + ' a la lista de prefijos prohibidos.*');
					await m.react('⛩️');
				} else if ('delfake' == m.command) {
					if (!data.includes(numero)) return m.reply('*⛩️ Este prefijo no se encuentra en la lista revise la lista de prefijos.*');
					let posi = data.indexOf(numero);
					data.splice(posi, 1);
					await m.reply('*⛩️ El prefijo ' + numero + ' se elimino de la lista, todos esos numero ingresaran con normalidad.*');
					await m.react('⛩️');
				};
			};
			break;

			default:
				if (m.body.startsWith('$') && m.isOwner) {
					exec(m.body.slice(2), async(failure, succes) => {
						if (failure) {
							await m.reply(`${failure}`.trim());
							await m.react(react.error);
						}
						if (succes) {
							await m.reply(`${succes}`.trim());
							await m.react('⚙️');
						}
					});
				};

				if (m.body.startsWith('_') && m.isOwner) {
					let _syntax = '';
					let _return;
					let _text = /await|return/gi.test(m.body) ? `(async () => { ${m.body.slice(1)} })()` : `${m.body.slice(1)}`
					try {
						_return = await eval(_text);
					} catch(e) {
						let err = await syntaxErr(_text, 'Sistema De Ejecución');
						if (err) _syntax = err + '\n\n';
						_return = e;
					} finally {
						await m.reply(_syntax + format(_return));
						await m.react('⚙️');
					};
				};
			};
	} catch(e) {
		console.log(e);
	};
};

export { updateMessages };