Deno.serve((req) => {
  if (req.headers.get("upgrade") !== "websocket") return new Response("OK");
  const { socket, response } = Deno.upgradeWebSocket(req);
  let conn: any = null;

  socket.onmessage = async (e) => {
    const b = new Uint8Array(e.data);
    if (!conn) {
      const o = 18 + b[17];
      const p = (b[o + 1] << 8) | b[o + 2];
      const t = b[o + 3];
      let h = "";
      
      if (t === 1) {
        h = `${b[o + 4]}.${b[o + 5]}.${b[o + 6]}.${b[o + 7]}`;
      } else if (t === 3) {
        const len = b[o + 4];
        h = new TextDecoder().decode(b.slice(o + 5, o + 5 + len));
      } else if (t === 2) {
        const ip = [];
        for (let i = 0; i < 16; i += 2) ip.push(((b[o + 4 + i] << 8) | b[o + 5 + i]).toString(16));
        h = ip.join(":");
      }

      try {
        conn = await Deno.connect({ hostname: h, port: p });
        socket.send(new Uint8Array([b[0], 0]));
        (async () => {
          const buf = new Uint8Array(8192);
          while (true) {
            const n = await conn.read(buf);
            if (!n) break;
            socket.send(buf.slice(0, n));
          }
        })();
        const hl = t === 1 ? o + 8 : (t === 3 ? o + 5 + b[o + 4] : o + 20);
        if (b.length > hl) await conn.write(b.slice(hl));
      } catch (err) {
        socket.close();
      }
    } else {
      await conn.write(b);
    }
  };

  socket.onclose = () => {
    try { if (conn) conn.close(); } catch (e) {}
  };

  return response;
});
