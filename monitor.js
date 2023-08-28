import "./config.js";
import path from "path";
import chalk from "chalk";
import watch from "node-watch";
import moment from "moment-timezone";
import { spawn } from "child_process";
import { EventEmitter } from "events";

const events = new EventEmitter();

function monitor() {
	let index = ['./index.js', ...process.argv.slice(2)];
	let cmd
	let start =	function() {
		cmd = spawn(process.argv[0], index, { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] })
			.on('error', (error) => {
				events.emit('warn', error);
			})
			.on('exit', (code, signal) => {
				events.emit('exit', code, signal);
			})
			.on('message', (message) => {
				events.emit('message', message);
			})
			cmd.setMaxListeners(0);
	};

	events.on('message', message => {
		if (message == 'restart') { 
			cmd.kill();  start();
		} else if (message == 'shutdown') forceKill(cmd.pid, 'SIGKILL');
	});

	events.on('exit', (code, signal) => {
		if (code != 0 && code != null && signal != 'SIGTERM') { cmd.kill(); start(); }
	});

	events.on('warn', error => {
		if (error) {  forceKill(cmd.pid, 'SIGKILL'); }
		else console.log(chalk.bgRed('Hubo un error en el sitema ' + error));
	});

	const ramCheck = setInterval(() => {
		let ramTotal = process.memoryUsage().rss
		if (ramTotal >= 900000000) {
			console.log(chalk.bgRed('El sitema exedio el consumo de 1GB de ram reiniciando para evitar problemas'));
			clearInterval(ramCheck);
			events.emit('message', 'reset');
		};
	});

	const timeFull = setInterval(() => {
		let time = moment.tz('America/Argentina/Buenos_Aires').format('HH:mm');
		let times = ['00:00', '06:00', '12:00', '18:00'];
		let isTimeFull = times.some(clock => clock == time);
		if (isTimeFull) {
			console.log(chalk.bgRed('El sitema llego a su tiempo limite de encendido reiniciando para evitar problemas'));
			clearInterval(timeFull);
			events.emit('message', 'reset');
		};
	});

	watch(path.resolve(), { recursive: true, filter(f, skip) { if (/\/node_modules/.test(f)) return skip; return /\.js$/.test(f) }, delay: 1000 }, (event, name) => {
		if (name && event == 'update') {
			let filename = path.basename(name);
			console.log(chalk.bgRed(`${filename} se actualizo, se reiniciara para aplicar los cambios.`));
			events.emit('message', 'reset');
		};
	});

	start();
};

function forceKill(pid, signal) {
	if(platform() == 'win32') {
		exec('taskkill /pid ' + pid + ' /T /F')
		return
	} else process.kill(pid, signal)
}

monitor()


///MONITOR ECHO POR Y PARA HIDEKI CUALQUIER COPIA BARATA SERA REPORTADA DE GITHUB. SE PUEDEN BASAR EN ESTE MONITOR PERO DEJAR CREDITOS DE AUTOR