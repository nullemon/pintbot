# Port Scout

A local, browser-based TCP port scanner for checking your home IP cameras and other devices. Add one IP, paste a list, import a text file, or enter an IP range. Scan all **65,535 TCP ports**, watch results arrive, check a service for camera/video evidence, and save CSV or JSON reports.

**Requires Python 3.10 or newer. No pip packages, administrator access, or account needed.** The app includes its own web interface; opening the HTML file directly will not run scans.

## Start in a minute

If you downloaded the single-file **`PortScout.py`**, run `py -3 PortScout.py` on Windows or `python3 PortScout.py` on macOS/Linux. It includes the interface and scanner; no extraction or extra packages are needed. Keep the terminal open while using it.

For the full-source ZIP:

1. Extract the entire ZIP to a folder.
2. Start the app:
   - **Windows:** double-click `start-windows.bat`.
   - **macOS:** open Terminal in the extracted folder and run `bash start-macos.command`. You can also double-click it if your system permits downloaded command files.
   - **Linux:** open a terminal in the folder and run `bash start-linux.sh`.
3. Your browser opens automatically at **http://127.0.0.1:8765**. If it does not, open the address printed in the terminal.
4. Add your camera's IP address or home subnet, select **All TCP ports**, click **Review targets**, then **Start scan**.
5. Leave the terminal running while using the app. Press **Ctrl+C** there when finished.

Alternatively, run this from the extracted folder:

```sh
python3 app.py
```

On Windows, use `py -3 app.py` or `python app.py`. If Python is missing, install Python 3.10+ from [python.org](https://www.python.org/downloads/), then restart the launcher. On Windows, enabling the installer's **Add Python to PATH** option also makes the `python` command available.

Useful launch options:

```sh
python3 app.py --no-browser
python3 app.py --port 9000
python3 app.py --port 0
```

`--port 0` selects a free port; use the address printed by the app. Change the port if another program is already using it. The server listens only on this computer's loopback interface (`127.0.0.1`).

## Add your targets

Paste targets separated by new lines, commas, or semicolons, or import a plain `.txt` file. You can mix these formats:

| Format | Example |
| --- | --- |
| One IPv4 address | `192.168.1.25` |
| IPv4 range | `192.168.1.10-192.168.1.40` |
| Short IPv4 range | `192.168.1.10-40` |
| IPv4 subnet | `192.168.1.0/24` |
| One IPv6 address | `2001:db8::10` |
| IPv6 subnet | `2001:db8::/127` |

Use your actual device addresses; `2001:db8::` is an example prefix. Repeated addresses are automatically removed. IPv4 subnets normally exclude the network and broadcast addresses; `/31` and `/32` include all their addresses. IPv6 `/127` and `/128` also include all their addresses.

One job supports **4,096 unique IP addresses** and **20,000,000 host/port checks**. A full 65,535-port scan fits up to 305 hosts per job. Split larger input into batches or choose a smaller port preset. The preview shows the workload before starting.

For a home LAN, find the camera's IP in your router's connected-device list or camera app. Run Port Scout on a computer connected to that home network. Private addresses such as `192.168.x.x`, `10.x.x.x`, or `172.16.x.x` through `172.31.x.x` are not directly reachable over the public internet.

## Choose your scan

- **All TCP ports:** checks ports `1-65535` for every target.
- **Camera ports:** a quick pass over common camera web, streaming, and vendor ports.
- **Common ports:** a shorter general-purpose TCP scan.
- **Custom:** enter ports and ranges such as `80,443,554,8000-8100`.

The port scan makes ordinary TCP connections and closes them. A successful connection marks a port **open**. Service labels are suggestions based on port numbers; an `RTSP` or `HTTP` label does not verify the protocol, identify a camera, or confirm that video is accessible. Use the separate **Check service** or **Check camera** action to inspect a protocol response and look for video evidence.

Results and progress update during the scan. **Open ports** shows every open IP/port pair; **Devices** groups open ports under each device IP. Use **View ports** to see all ports for one device, or include hosts without open ports to review their counts. A device here means an IP address, not a verified camera identity. Filter results and export a CSV or JSON report. **Stop** cancels further work and preserves the partial results for export. Starting another scan replaces the previous scan's results. Results stay in memory and disappear when you exit the app, so export anything you want to keep.

### Settings and result meanings

| Setting | Range | What it changes |
| --- | --- | --- |
| Timeout | 100–5,000 ms | How long each connection attempt may wait |
| Concurrency | 1–256; default 128 | Maximum simultaneous connection attempts |
| Retries | 0–2; default 1 | Additional attempts for timed-out or errored connections |

The UI's default timeout is 800 ms. If a camera is slow, lower concurrency and increase the timeout. A full scan can take several minutes or longer when devices or firewalls silently discard traffic, especially with retries. Higher concurrency can also overwhelm a small camera, router, or your computer's available sockets.

- **Open:** the TCP connection succeeded.
- **Closed:** the connection was explicitly refused.
- **No response / timeout:** the attempt reached its timeout. This does **not** establish that the port is closed; a firewall, dropped packet, or sleeping device may explain it.
- **Error:** the connection failed for another reason, such as an unreachable network, unsupported address, or local socket/resource limit. Check your network and try lower concurrency if necessary.

Connection latency measures the successful TCP connection attempt, not camera video delay or a full application response. Timing can vary under load.

## Check whether an open port serves camera video

An open port, including **8000**, only confirms that something accepted a TCP connection. Some cameras use port 8000 for a vendor-specific protocol that a browser and this verifier cannot read. Port Scout cannot guarantee a video feed from every open port.

1. Select **Check service** beside an open-port result, or use **Check camera** to enter a host and port manually.
2. Choose **Auto**, **HTTP**, **HTTPS**, or **RTSP**. Auto tests the supported protocols; it does not try a list of camera paths.
3. Choose the root path, one appropriate camera path preset, or enter the exact path from your camera's documentation. Included presets are Hikvision's `/Streaming/Channels/101` and Dahua's `/cam/realmonitor?channel=1&subtype=0`. These paths are useful only when your device supports them; they do not identify its manufacturer.
4. If your camera requires a login, optionally enter **your own username and password**. Credentials are used for this check, kept in memory, and cleared when you close the dialog. No default passwords, brute-force attempts, or path-wordlist searches are performed.
5. Run the check and read the evidence reported below the result. Each protocol has a short timeout, and an RTSP check can wait another 2.5 seconds for video packets. An Auto check may take about 12 seconds.

HTTPS certificate verification is enabled by default. If your own camera uses a self-signed certificate, the dialog offers an optional allowance for that check; it starts disabled.

### What the verification result establishes

| Result | Evidence |
| --- | --- |
| **Video confirmed** | RTSP video RTP packets were received after SDP, SETUP, and PLAY, or an image frame was observed in an MJPEG response. RTSP packets are not decoded, so this does not prove that a viewable picture was produced. |
| **Video advertised** | An RTSP SDP response declares a video stream, but no video frame packets were observed within the check. |
| **Snapshot confirmed** | A still JPEG was observed. This confirms an image response, not a live stream. |
| **Authentication required** | The service requested a login. Enter your own camera credentials to check further. |
| **Web service** | The port answered HTTP or HTTPS; that response alone does not establish video. |
| **RTSP service** | An RTSP response was received, without enough evidence to confirm video. |
| **SSH service** | An SSH banner was received. SSH provides a remote command line and requires the device's configured account; this is not camera video. |
| **Playlist** | A media playlist was returned; playback and its referenced media have not been confirmed. |
| **Media response** | A response suggests media, without enough evidence to confirm a video frame. |
| **TLS untrusted** | HTTPS certificate verification failed. Review the certificate/self-signed setting for your own camera. |
| **Unknown** | The supported checks did not identify usable protocol or video evidence. The port may use another protocol, need a different path, or respond too slowly. |

For an **unbranded camera**, first find its actual private IP in your router's connected-device list. Check its original app, the QR code on its label or box, and its manual for the correct RTSP/stream path. A public address such as `103.x.x.x` is not the camera's private home-LAN address.

Use **Copy URL** to take the checked address to VLC's **Open Network Stream**. The copied URL leaves out credentials; enter your camera's login when VLC prompts. Browsers do not normally play RTSP URLs directly. Port Scout reports protocol/video evidence and does not decode or display the live feed itself. Watching the stream in a player remains the way to confirm that it shows the picture you expect.

## Check access before traveling

For routine travel access, a home VPN such as **Tailscale or WireGuard** is usually the best path: connect to your home network, then use the camera's private address. A home subnet router or VPN endpoint must be configured to reach other home devices; installing a VPN client only on your travel laptop is not enough.

Before leaving, find the camera's private IP, confirm its stream locally with **Check camera**, and open the copied URL in VLC. Then connect your laptop to a phone hotspot, connect your home VPN, and repeat with the same private address and path. This checks the route you will use while traveling.

To check existing public exposure, scan your own public IPv4 address or the camera's reachable public IPv6 address **from outside your home network**, such as a laptop on a phone hotspot. A scan from inside the home can behave differently because routers handle NAT loopback differently. An open port on a public address may belong to the router or another forwarded device; confirm your router configuration.

With IPv4, access depends on port forwarding, router/firewall rules, and your ISP. Carrier-grade NAT (CGNAT) can prevent inbound connections even when local forwarding is configured. IPv6 access depends on routing and firewall rules too. Port Scout reports what the computer running it can reach; it does not set up remote access or open router ports.

## Local operation and limits

- The interface and scan engine run on your computer. No analytics, external scripts, or external fonts are used.
- Scans do not need camera credentials. The optional service check can use credentials you enter; they stay in memory for the check and are cleared from the dialog when it closes. Reports are only written when you export them.
- This is a **TCP** scanner with optional HTTP, HTTPS, and RTSP verification. It does not scan UDP, discover ONVIF devices, or decode/display live video.
- Camera verification checks the one path you choose. The correct path and login may be required even when a TCP port is open.
- A port can change state after a scan, and timeout settings can miss slow responses. Rescan important findings with a longer timeout when needed.
- Use it for your own devices and networks you are authorized to test.

## Troubleshooting

**The launcher says Python is missing:** install Python 3.10+ and retry. On Windows, try `py -3 app.py` from a terminal in the extracted folder.

**The browser says it cannot connect:** keep the launcher's terminal open and use the URL it printed. If port 8765 is occupied, run `python3 app.py --port 0`.

**No ports appear:** check the camera's IP and power, your Wi-Fi/VPN connection, and the selected port range. Review timeout and error counts. Try a longer timeout and lower concurrency. A device can be online while every scanned TCP port is closed or filtered.

**Port 8000 is open but nothing opens in a browser:** run **Check service** and read the protocol evidence. If it remains unknown, use the original camera app/manual to find its web or RTSP port and exact stream path. A proprietary camera service may accept connections without offering a web page or a standard video stream there.

**Windows asks about firewall access:** the UI is bound to loopback; it does not need to be exposed to other computers. Outgoing TCP connections must be allowed for scans to work.

**Double-clicking on macOS is blocked:** launch with `bash start-macos.command` from Terminal in the extracted folder. The terminal will show any Python or startup error.

## License

MIT; see `LICENSE`.

## Development checks

The included tests use only Python's standard library and local loopback sockets:

```sh
python3 -m unittest discover -s tests -v
```
