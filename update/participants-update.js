import '../config.js';
import { parsePhoneNumber } from 'libphonenumber-js';

const delay = (timeout) => new Promise((resolve) => setTimeout(resolve, timeout));

const reply = async (sock, id, text = '', options = {}) => {
  const p = Math.random() < 0.5 ? 1 : 0;
  const mentions = options.mentions || sock.parseMention(text);
  const title = p === 1 ? '⛩️¡Seguínos en Instagram!⛩️' : '⛩️¡Seguínos en Facebook!⛩️';
  const body = await sock.getName(id);
  const image = 'https://telegra.ph/file/7c88adc390f833300232f.jpg';
  const url = p === 1
    ? 'https://instagram.com/hotaru.ofc?igshid=NzZhOTFlYzFmZQ=='
    : 'https://www.facebook.com/Somoshotaru?mibextid=ZbWKwL';

  await sock.sendText(id, text, {
    mentions,
    ads: true,
    title,
    body,
    image,
    url,
  });
};

const updateParticipants = async ({ sock, id, participants, action }) => {
  try {
    if (participants?.includes(sock.user.jid)) return;

    const { announce } = await sock.groupMetadata(id).catch(console.error);
    const isWelcome = db.data?.chats[id]?.welcome;
    const isAntifake = db.data?.chats[id]?.antifake;
    const dataFake = db.data?.chats[id]?.fake;
    const sender = participants[0];
    const sender2 = participants[1] || '0@s.wahtsapp.net';

    if (isAntifake) {
      const phoneNumber = parsePhoneNumber(`+${sender.split('@')[0]}`);
      const isFake = dataFake.some((cmd) => phoneNumber.number.startsWith(cmd));
      if (isFake && action === 'add') {
        await reply(sock, id, `*⛩️ Lo siento el prefijo +${phoneNumber.countryCallingCode} no está permitido en este grupo, así que será eliminado @${sender.split('@')[0]}.*`);
        await delay(2500);
        await sock.groupParticipantsUpdate(id, [sender], 'remove');
        await delay(2500);
        return await sock.updateBlockStatus(sender, 'block');
      }
    }

    switch (action) {
      case 'add': {
        if (isWelcome) {
          if (!announce) {
            const welcomeMessage = db.data.chats[id]?.customWel;
            const teks = welcomeMessage.replace('@user', `@${sender.split`@`[0]}`).replace('@group', await sock.getName(id)).replace('@desc', meta.desc);
            await reply(sock, id, teks.trim());
          } else {
            await reply(sock, id, '*⛩️ El grupo está cerrado por los administradores, aguarde hasta que se abra por la mañana para ser atendido, sea paciente*');
          }
        }
        break;
      }

      case 'remove': {
        if (isWelcome) {
          const byeMessage = db.data.chats[id]?.customBye;
          const teks = byeMessage.replace('@user', `@${sender.split('@')[0]}`).replace('@group', await sock.getName(id)).replace('@desc', meta.desc);
          await reply(sock, id, teks.trim());
        }
        break;
      }

      case 'promote': {
        const promote = `*⛩️ Nuevo Usuario Promovido ⛩️*\n\n*Usuario:* @${sender.split('@')[0]}\n*Promovido por:* @${sender2.split('@')[0]}\n\n@${sender.split('@')[0]} *Usted fue añadido al grupo de administradores a partir de ahora.*`;
        await reply(sock, id, promote.trim(), { mentions: [...(await sock.getAdmins(id) || [])] });
        break;
      }

      case 'demote': {
        const demote = `*⛩️ Nuevo Usuario Degradado ⛩️*\n\n*Usuario:* @${sender.split('@')[0]}\n*Degradado por:* @${sender2.split('@')[0]}\n\n@${sender.split('@')[0]} *Usted a dejado de pertenecer al grupo de admins a partir de ahora.*`;
        await reply(sock, id, demote.trim(), { mentions: [...(await sock.getAdmins(id) || [])] });
        break;
      }
    }
  } catch (e) {
    console.error(e);
  }
};

export { updateParticipants };