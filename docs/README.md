*This project has been created as part of the 42 curriculum by matnusko.*

# NetPractice

## Description

NetPractice is an introduction to computer networking through 10 practical exercises. Each level presents a simulated network with an incomplete or incorrect configuration. The goal is to restore communication between devices by adjusting the available IP addresses, subnet masks, and routing entries.

The project develops an understanding of how devices communicate within a subnet and how routers forward traffic between different networks. It involves configuring networks through a browser interface rather than writing or compiling a program.

## Instructions

### Run the training interface

1. Download the NetPractice training archive from the project's page on the 42 intranet.
2. Extract the archive and open a terminal in the extracted directory.
3. Start the interface:

   ```sh
   bash run.sh
   ```

   The script starts a local web server and opens the interface in your browser.

4. If the script does not work, run the following command from the extracted directory, with Python 3 installed:

   ```sh
   python3 -m http.server 49242
   ```

   Then open [http://localhost:49242](http://localhost:49242) in your browser. Keep the server running while using the interface.

5. Enter the intra login **matnusko** to use the personal training configuration.

No compilation is required. The training interface is provided separately by 42.

### Complete levels and export configurations

1. Read the objectives and inspect the network diagram.
2. Modify the editable fields to correct the network configuration.
3. Click **Check again** to test the configuration. Use the logs to understand any remaining errors.
4. Once the level is successful, click **Get my config** to download its configuration **before moving to the next level**.
5. Repeat for all 10 levels.

### Submission

Place **10 exported configuration files, one per level, at the root of the Git repository**, together with this `README.md`. Preserve the exported filenames and check that every level is represented. Export the configurations using the login **matnusko**.

During peer evaluation, the subject requires completing three random levels within a limited time. External tools are not allowed, except a simple calculator such as `bc`.

## Resources

### Networking concepts studied

- **TCP/IP addressing:** IPv4 addresses and the distinction between network and host portions.
- **Subnet masks and CIDR notation:** identifying subnet boundaries and determining whether two devices belong to the same subnet.
- **Network and broadcast addresses:** understanding addresses reserved within a subnet and choosing valid host addresses.
- **Default gateways:** reaching destinations outside the local subnet through a reachable router interface.
- **Routers and routing tables:** forwarding packets between networks using destination networks and next hops, including return routes.
- **Switches:** connecting devices within a local network and understanding how their role differs from that of routers.
- **OSI layers:** understanding the layered model, particularly the data link layer (Layer 2) and network layer (Layer 3).

### Additional references

These references complement the interactive AI course used as my main learning resource:

- [RFC 791 — Internet Protocol](https://www.rfc-editor.org/rfc/rfc791): the IPv4 specification and addressing fundamentals.
- [RFC 4632 — Classless Inter-domain Routing (CIDR)](https://www.rfc-editor.org/rfc/rfc4632): address prefixes and classless routing.
- [Cisco — Networking Basics](https://www.cisco.com/site/us/en/learn/topics/small-business/networking-basics.html): an introduction to networks, switches, and routers.
- [Cloudflare — What is the OSI Model?](https://www.cloudflare.com/learning/ddos/glossary/open-systems-interconnection-model-osi/): an explanation of the seven OSI layers.

### Use of AI

I learned primarily with the help of AI, which created an interactive course for me on the networking concepts covered by NetPractice. This course was my main learning support for understanding IP addressing, subnet masks, gateways, and routing, and for approaching the exercises.

AI also assisted with drafting and structuring this README, including the execution instructions and additional references. The additional references are provided for further reading; they are not presented as my main learning sources.
