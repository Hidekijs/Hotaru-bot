import "./config.js";
import P from "pino";
import chalk from "chalk";
import { Boom } from "@hapi/boom";
import { makeWAClient } from "./lib/simple.js";
import {
	DisconnectReason,
	makeInMemoryStore,
	useMultiFileAuthState
} from "baileys";
import { updateMessages } from './update/messages-upsert.js';
import { updateParticipants } from './update/participants-update.js';

const { state, saveCreds } = await useMultiFileAuthState(name_sessions);
global.store = makeInMemoryStore({
	logger: P().child({
		level: "silent", stream: "store"
	})
})

const start = async() => {

	let client = await makeWAClient({
		logger: P({
			level: "silent"
		}),
		printQRInTerminal: true,
		auth: state
	})

	store.bind(client.ev);

	client.ev.on("creds.update", saveCreds);

	client.ev.on("connection.update", async({qr, connection, lastDisconnect}) => {
		if (qr) {
			console.log("Escanee este QR para conectarse al bot.");
		};

		if (connection == "close") {
			let reason = new Boom(lastDisconnect?.error)?.output?.statuscode

			if (reason == DisconnectReason.badSession) { console.log(chalk.bgRed(`Se daño la carpeta ${global.name_sessions}, borre la carpeta y escanee el QR nuevamente.`)); process.exit(); }
			else if (reason == DisconnectReason.connectionClose) { console.log(chalk.bgRed("Se cerro la conexion conectando de nuevo")); start(); }
			else if (reason == DisconnectReason.connectionLost) { console.log(chalk.bgRed("Se perdio la conexion con el servidor reconectando...")); start(); }
			else if (reason == DisconnectReason.connectionReplaced) { console.log(chalk.bgRed("Se creo una nueva sesion y reemplazo la actual, revise y escanee nuevamente el QR")); process.exit(); }
			else if (reason == DisconnectReason.loggedOut) { console.log(chalk.bgRed(`El dispositivo se desvinculo, borre la carpeta ${info.name_sessions} y escanee el codigo QR nuevamente.`)); process.exit(); }
			else if (reason == DisconnectReason.restartRequire) { console.log(chalk.bgRed("Es necesario reiniciar, se reiniciara automaticamente aguarde...")); start(); }
			else if (reason == DisconnectReason.timedOut) { console.log(chalk.bgRed("Se agoto el tiempo de espera, reconectando...")); start(); }
			else { 
				console.log(chalk.bgRed(`Error de desconexion desconocido: ${reason}||${connection}`))
			};
		} if (connection == "open") {
			await sock.getMetadata;
			console.log("Sistema en linea.");
		};
	});

	client.ev.on("messages.upsert", client.serealizeMessage);

	client.ev.on("serealize.message", updateMessage);

	client.ev.on("contacts.update", async uptade => {
		for (let contact of uptade) {
			let id = client.decodeJid(contact.id);
			if (store.contacts) client.contacts[id] = { id, name: contact.verifiedName || contact.notify };
		};
	});

	if (global.metadata.reload) { 
		if (store.groupMetadata) setInterval(() => client.getMetadata , 15_000);
	};

	return client;
};

start();