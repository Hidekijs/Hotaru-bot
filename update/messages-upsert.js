import "../config.js";
import { format } from "util";
import speed from "performance-now";
import { exec } from "child_process";
import syntaxErr from "syntax-error";
import { dataBase } from "../lib/db.js";

const updateMessages = async({sock, m}) => {
	try {

		let v = m.quoted ? m.quoted : m;

		await dataBase(sock, m, db); await sock.readMessages([m.key]);

		let meta = store.groupMetadata[m.from];
		let groupAdmins = await sock.getAdmins(m.from);

		///[ BASE DE DATOS ]///
		let isAntilink = db.data.chats[m.from]?.antilink
		let isAntifake = db.data.chats[m.from]?.antifake
		let isWelcome = db.data.chats[m.from]?.welcome;
		let isBadWord = db.data.chats[m.from]?.badword
		let isMute = db.data.chats[m.from]?.mute

		if (isAntilink) {
			let exec = /https?:\/\/|chat.whatsapp.com\/(?:invite\/)?([0-9A-Za-z]{20,24})|wa.me\/?([0-9])|t.me\/?([0-9])/gi
			let isLink = exec.test(m.body.trim());
			if (isLink) {
				if (m.body.includes("https://chat.whatsapp.com/" + meta.code)) continue;
				if (m.fromMe) return;
				if (m.isOwner) continue;
				if (m.isAdmin && !m.isOwner) {
					await m.delete();
					return await m.reply("*⛩️ Stupid admin no envies links prohibidos da el ejemplo.*");
				};
				await sock.groupParticipantsUpdate(m.from, [m.sender], "remove");
				await m.delay(1500);
				await m.delete();
				await m.reply("*⛩️ Su mensaje contiene un link prohibido fue eliminado su mensaje junto con el remitente*");
			};
		};

		switch (m.command) {

			case "kick":
			case "pafuera":
			case "eliminar": {
				if (!m.isBotAdmin) return m.reply("*⛩️ No se puede usar esta funcion si no soy administrador.*");
				if (!m.isAdmin) return m.reply("*⛩️ Esta funcion es solo para los administradores.*");
				if (m.mentionedJid.length == 0) return m.reply("*⛩️ Marque un mensaje o use @ para elegir a quien eliminar.*");
				let user = m.mentionedJid && m.mentionedJid[0] || m.quoted.sender;
				if (sock.user.jid == user) return m.reply("*⛩️ No puedo autoeliminarme.*");
				if (groupAdmins.includes(user) && !m.isOwner) return m.reply("*⛩️ Mis permisos no me permiten eliminar a otro administrador.*");
				if (user == m.sender) return m.reply("*⛩️ No puedes autoeliminarte.*")
				if (user.split("@")[0] && mod.includes(user.split("@")[0])) return m.reply("*⛩️ Lo siento este usuario es un moderador no puede ser vulnerado por el bot.*");
				await sock.groupParticipantsUpdate(m.from, [user], "remove");
				await m.reply("*⛩️ El usuario @" + user.split`@`[0] + " ya no forma parte del grupo.*");
				await m.react("⛩️");
			};
			break;

			case "promote":
			case "demote":{
				if (!m.isBotAdmin) return m.reply("*⛩️ No se puede usar esta funcion si no soy administrador.*");
				if (!m.isOwner) {
					await m.reply("*⛩️ Lo siento usted no tiene los suficientes privilegios para usar este comando por seguridad se le quitara administracion.*")
					return await sock.groupParticipantsUpdate(m.from, [m.sender], "demote");
				};
				let user = (m.mentionedJid.length != 0) ? m.mentionedJid[0] : m.quoted.sender;
				if (!user) return m.reply("*⛩️ Marque un mensaje o use @ para elegir a quien darle o quitar administracion.*");
				if (m.command == "promote") {
					if (groupAdmins.includes(user)) return m.reply("*⛩️ Este usuario ya posee privilegios de administrador.*");
					await m.react("⛩️");
					await sock.groupParticipantsUpdate(m.from, [user], "promote");
					await m.reply("*⛩️ El usuario @" + user.split("@")[0] + " a recibido el cargo de administrador por un _super usuario_.*", { mentions: await sock.getAdmins(m.from) });
				} else if (m.command == "demote") {
					if (!groupAdmins.includes(user)) return m.reply("*⛩️ Este usuario no posee privilegios de administrador.*");
					await m.react("⛩️");
					await sock.groupParticipantsUpdate(m.from, [user], "demote");
					await m.reply("*⛩️ El usuario @" + user.split("@")[0] + " se elimino del cargo de administrador por un _super usuario_.*", { mentions: await sock.getAdmins(m.from) });
				};
			};
			break

			case "antilink":{
				if (!m.isBotAdmin) return m.reply("*⛩️ No se puede usar esta funcion si no soy administrador.*");
				if (!m.isAdmin) return m.reply("*⛩️ Esta funcion es solo para los administradores.*");
				if (!m.mentionedJid && !m.quoted) return m.reply("*⛩️ Marque un mensaje o use @ para elegir a quien eliminar.*");
				if (/true|activar|on/.test(m.args[0])) {
					if (isAntilink) return m.reply("*⛩️ Esta funcion esta activa en este grupo.*");
					m.data(m.from).antilink = true;
					await m.reply("*⛩️ Se activo el antilink correctamente. Se prohibe cualquier tipo de url.*");
					await m.react("⛩️");
				} else if (/false|desactivar|off/.test(m.args[0])) {
					if (!isAntilink) return m.reply("*⛩️ Esta funcion esta desactivada en este grupo.*");
					m.data(m.from).antilink = false;
					await m.reply("*⛩️ La funcion antilinks se desactivo.*");
					await m.react("⛩️");
				} else m.reply("*⛩️ Utilice on/off para interactuar con esta funcion.*");
 			};
			break;

			case "antifake":
			case "fake": {
				if (!m.isBotAdmin) return m.reply("*⛩️ No se puede usar esta funcion si no soy administrador.*");
				if (!m.isAdmin) return m.reply("*⛩️ Esta funcion es solo para los administradores.*");
				if (/on|true|activar/.test(m.args[0])) {
					if (isAntifake) return m.reply("*⛩️ Esta funcion esta activa en este grupo.*");
					m.data(m.from).antifake = true;
					await m.reply("*⛩️ Se activo el antifake. Ingrese los numero o prefijos con addfake o elimine con delfake.*");
					await m.react("⛩️");
				} else if(/off|false|desactivar/.test(m.args[0])) {
					if (!isAntifake) return m.reply("*⛩️ Esta funcion esta desactivada en este grupo.*");
					m.data(m.from).antifake = false;
					await m.reply("*⛩️ Se desactivo el antifake. El filtro de numeros dejara ingresar culquier numero.*");
					await m.react("⛩️");
				} else m.reply("*⛩️ Utlice activar o desactivar para interactuar con esta funcion.*");
			};
			break;

			case "addfake":
			case "delfake":
			case "fakelist":{
				if (!m.isBotAdmin) return m.reply("*⛩️ No se puede usar esta funcion si no soy administrador.*");
				if (!m.isAdmin) return m.reply("*⛩️ Esta funcion es solo para los administradores.*");
				if (!isAntifake) return m.reply("*⛩️ La funcion antifake debe encontrarse activa para utilizar estos elementos.*");
				if (!m.text) return m.reply("*⛩️ Ingrese un prefijo que desea anular al ingresar a este grupo.*");
				let numero = m.text.startsWith("+") ? m.text : "+" + m.text;
				let data = m.data(m.from)?.fake || db.data.chats[m.from]?.fake;
				if ("addfake" == m.command) {
					if (data.includes(numero)) return m.reply("*⛩️ Este prefijo se encuentra en la lista.*");
					data.push(numero);
					await m.reply("*⛩️ Se agrego " + numero + " a la lista de prefijos prohibidos.*");
					await m.react("⛩️");
				} else if ("delfake" == m.command) {
					if (!data.includes(numero)) return m.reply("*⛩️ Este prefijo no se encuentra en la lista revise la lista de prefijos.*");
					let posi = data.indexOf(numero);
					data.splice(posi, 1);
					await m.reply("*⛩️ El prefijo " + numero + " se elimino de la lista, todos esos numero ingresaran con normalidad.*");
					await m.react("⛩️");
				};
			};
			break;

			case "welcome":{
				if (!m.isAdmin) return m.reply("*⛩️ Esta funcion es solo para los administradores.*");
				if (/activar|true|on/.test(m.args[0])) {
					if (isWelcome) return m.reply("*⛩️ Esta funcion esta activa en este grupo.*");
					m.data(m.from).welcome = true;
					await m.reply("*⛩️ Se activo la bienvenida. Si desea modificarla utilice setwelcome o setbye.*");
					await m.react("⛩️");
				} else if (/false|desactivar|off/.test(m.args[0])) {
					if (!isWelcome) return m.reply("*⛩️ Esta funcion esta desactivada en este grupo.*");
					m.data(m.from).welcome = false;
					await m.reply("*⛩️ Se desactivo la bienvenida en este grupo.*");
					await m.react("⛩️");
				} else m.reply("*⛩️ Utilice activar o desactivar para interactuar con esta funcion.*");
			};
			break;

			case "setbye":
			case "setwelcome":{
				if (!m.isAdmin) return m.reply("*⛩️ Esta funcion es solo para los administradores.*");
				if (!isWelcome) return m.reply("*⛩️ Esta funcion no funciona si no esta la bienvenida encendida.*");
				if ("setwelcome" == m.command) {
					if (!m.text) return m.reply("*⛩️ Ingrese una bienvenida que quiere que muestre. Los valores que se pueden reemplazar son "@user"-"@group"-"@desc".*");
					m.data(m.from).customWel = m.text.trim();
					await m.reply("*⛩️ Se modifico la bienvenida de este grupo.*");
					await m.react("⛩️");
				} else if("setbye" == m.command) {
					if (!m.text) return m.reply("*⛩️ Ingrese una despedida que quiere que muestre. Los valores que se pueden reemplazar son "@user"-"@group"-"@desc".*");
					m.data(m.from).customBye = m.text.trim();
					await m.reply("*⛩️ Se modifico la despedida de este grupo.*");
					await m.react("⛩️");
				};
			};
			break;

			case "test":{
				if (!m.isAdmin) return m.reply("*⛩️ Esta funcion es solo para los administradores.*");
				if (!isWelcome) return m.reply("*⛩️ Esta funcion no funciona si no esta la bienvenida encendida.*");
				if (/welcome|wel|bienvenida/.test(m.args[0])) {
					let Welcome = db.data.chats[m.from]?.customWel;
					let teks = Welcome.replace("@user", `@${m.sender.split("@")[0]}`).replace("@group", await sock.getName(m.from)).replace("@desc", meta.desc);
					await m.reply(teks.trim());
					await m.react("⛩️");
				} else if(/bye|despedida/.test(m.args[0])) {
					let Bye = db.data.chats[m.from]?.customBye;
					let teks = Bye.replace("@user", `@${m.sender.split("@")[0]}`).replace("@group", await sock.getName(m.from)).replace("@desc", meta.desc);
					await m.reply(teks.trim());
					await m.react("⛩️");
				} else m.reply("*⛩️ Utilice welcome o bye para testear las funciones.*");
			};
			break;

			///[ OWNERS Y MDOS ]///

			case "join":
			case "unirse":{
				if (!m.isOwner) return m.reply("*⛩️ Lo siento esto es una funcion exclusiva para moderadores y el dev.*");
				if (!m.text) return m.reply("*⛩️ Ingrese un link de invitacion para poder unirme al grupo.*");
				let code = m.text.split("chat.whatsapp.com/")[1];
				let data = await sock.groupGetInviteInfo(code);
				if (Object.keys(store.groupMetadata).includes(data.id)) {
					await m.reply("*⛩️ Ya me encuentro en ese grupo*")
					if (m.from != data.id) { return await m.reply("Aqui esto jefe en que puedo ayudarle* @" + m.number, { id: data.id }) } else return !0;
				};
				await sock.groupAcceptInvite(code).then(async() => {
					await m.reply("*⛩️ Me uni correctamente a " + data.subject + "*");
					await m.react("⛩️");
					await m.delay("2500");
					await m.reply("*⛩️ Hola a todos soy " + bot.name + " fui invitado por @" + m.number + " para administrar este grupo espro llevarnos bien.*", { id: data.id });
				}).catch(async(e) => {
					await m.reply("*⛩️ Lo siento no pude sincronizar para unirme intente con otro enlace o añadiendome manualmente.*");
					console.log(e)
				});
			};
			break;

			case "ping": {
				if (!m.isOwner) return;
				let timestampe = speed();
				let latensie = speed() - timestampe
				await m.reply("*PONG! 🏓*\n\nVelocidad de respuesta: " + latensie.toFixed(3) + "ms");
			};
			break;

			default:
				if (m.body.startsWith("$") && m.isOwner) {
					exec(m.body.slice(2), async(failure, succes) => {
						if (failure) {
							await m.reply(`${failure}`.trim());
							await m.react(react.error);
						}
						if (succes) {
							await m.reply(`${succes}`.trim());
							await m.react("⚙️");
						}
					});
				};

				if (m.body.startsWith("_") && m.isOwner) {
					let _syntax = "";
					let _return;
					let _text = /await|return/gi.test(m.body) ? `(async () => { ${m.body.slice(1)} })()` : `${m.body.slice(1)}`
					try {
						_return = await eval(_text);
					} catch(e) {
						let err = await syntaxErr(_text, "Sistema De Ejecución");
						if (err) _syntax = err + "\n\n";
						_return = e;
					} finally {
						await m.reply(_syntax + format(_return));
						await m.react("⚙️");
					};
				};
			};
	} catch(e) {
		console.log(e);
	};
};

export { updateMessages };