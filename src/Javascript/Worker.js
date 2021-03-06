/*

(づ￣ ³￣)づ

IPFS (Shared) Worker.
Pretty much copied from an example on https://github.com/ipfs/js-ipfs

*/

import localforage from "localforage"
import { Server, IPFSService } from "ipfs-message-port-server"


self.apiEndpoint = API_ENDPOINT

const KEEP_ALIVE_INTERVAL =
  1 * 60 * 1000 // 1 minute

const OPTIONS = {
  config: {
    Addresses: {
      Delegates: []
    },
    Bootstrap: [],
    Discovery: {
      webRTCStar: { enabled: false }
    }
  },
  preload: {
    enabled: false
  },
  libp2p: {
    config: {
      peerDiscovery: { autoDial: false }
    }
  }
}

let peers = Promise.resolve(
  []
)


importScripts("web_modules/ipfs.min.js")


const main = async (port) => {
  const IPFS = self.Ipfs
  self.initiated = true

  // Start listening to all the incoming connections (browsing contexts that
  // which run new SharedWorker...)
  // Note: It is important to start listening before we do any await to ensure
  // that connections aren't missed while awaiting.
  const connections = listen(self, "connect")

  // Fetch the list of peers
  peers = await localforage.getItem("ipfsPeers")

  if (peers) {
    peers = peers.split(",")

    fetchPeers().then(list =>
      localforage.setItem("ipfsPeers", list.join(","))
    )

  } else {
    peers = await fetchPeers()
    localforage.setItem("ipfsPeers", peers.join(","))

  }

  if (peers.length === 0) {
    throw new Error("💥 Couldn't start IPFS node, peer list is empty")
  }

  // Start an IPFS node & create server that will expose it's API to all clients
  // over message channel.
  const ipfs = await IPFS.create(OPTIONS)
  const service = new IPFSService(ipfs)
  const server = new Server(service)

  self.ipfs = ipfs
  self.service = service
  self.server = server

  peers.forEach(peer => {
    tryConnecting(peer)
  })

  console.log("🚀 Started IPFS node")

  // Monitor bitswap automatically if on localhost and staging environment
  if ([ "localhost", "auth.runfission.net" ].includes(self.location.hostname)) {
    monitorBitswap()
  }

  // Connect every queued and future connection to the server.
  if (port) {
    server.connect(port)
    return
  }

  for await (const event of connections) {
    const p = event.ports && event.ports[0]
    if (p) server.connect(p)
  }
}


function fetchPeers() {
  const peersUrl = `${self.apiEndpoint}/ipfs/peers`

  return fetch(peersUrl)
    .then(r => r.json())
    .then(r => r.filter(p => p.includes("/wss/")))
    .catch(e => { throw new Error("💥 Couldn't start IPFS node, failed to fetch peer list") })
}


async function keepAlive(peer) {
  const timeoutId = setTimeout(() => reconnect(peer), 30 * 1000)

  self.ipfs.libp2p.ping(peer).then(() => {
    clearTimeout(timeoutId)
  }).catch(() => {}).finally(() => {
    setTimeout(() => keepAlive(peer), KEEP_ALIVE_INTERVAL)
  })
}


async function reconnect(peer) {
  await self.ipfs.swarm.disconnect(peer)
  await self.ipfs.swarm.connect(peer)
}


async function tryConnecting(peer) {
  self
    .ipfs.libp2p.ping(peer)
    .then(() => {
      return ipfs.swarm
        .connect(peer, 15 * 1000)
        .then(() => {
          console.log(`🪐 Connected to ${peer}`)

          // Ensure permanent connection to Fission gateway
          // TODO: This is a temporary solution while we wait for
          //       https://github.com/libp2p/js-libp2p/issues/744
          //       (see "Keep alive" bit)
          setTimeout(() => keepAlive(peer), KEEP_ALIVE_INTERVAL)
        })
    })
    .catch(() => {
      console.log(`🪓 Could not connect to ${peer}`)
    })
}


self.reconnect = reconnect



// 🔮


let monitor


async function asyncIteratorToArray(it) {
  const chunks = []

  for await (const chunk of it) {
    chunks.push(chunk)
  }

  return chunks
}


async function monitorBitswap(verbose) {
  const cids = {}
  const seen = []

  verbose = verbose === undefined ? false : true

  console.log("🕵️‍♀️ Monitoring IPFS bitswap requests")
  await stopMonitoringBitswap()

  monitor = setInterval(async () => {
    const peerList = await Promise.resolve(peers)

    peerList.map(async peer => {
      const peerId = peer.split("/").reverse()[0]
      const wantList = await ipfs.bitswap.wantlistForPeer(peerId, { timeout: 120 * 1000 })

      wantList.forEach(async cid => {
        const c = cid.toString()
        const s = peerId + "-" + c

        if (!seen.includes(s)) {
          const seenCid = !!cids[c]
          const emoji = seenCid ? "📡" : "🔮"
          const msg = `${emoji} Peer ${peerId} requested CID ${c}`

          cids[c] = (cids[c] || 0) + 1

          if (seenCid) {
            if (verbose) console.log(msg + ` (#${cids[c]})`)
            return
          } else {
            console.log(msg)
          }

          const start = performance.now()
          seen.push(s)

          const dag = await ipfs.dag.get(cid)
          const end = performance.now()
          const diff = end - start
          const loaded = `loaded locally in ${diff.toFixed(2)} ms`

          if (dag.value.Links) {
            console.log(`🧱 ${c} is a 👉 DAG structure (${loaded})`)
            ;(console.table || console.log)(
              dag.value.Links.map(l => {
                return { name: l.Name, cid: l.Hash.toString() }
              })
            )

          } else {
            console.log(`📦 ${c} is 👉 Data (${loaded})`)
            console.log(dag.value)

          }
        }
      })
    })
  }, 20)
}


async function stopMonitoringBitswap() {
  if (monitor) clearInterval(monitor)
}


self.monitorBitswap = monitorBitswap
self.stopMonitoringBitswap = stopMonitoringBitswap



// 🚀


/**
 * Creates an AsyncIterable<Event> for all the events on the given `target` for
 * the given event `type`. It is like `target.addEventListener(type, listener, options)`
 * but instead of passing listener you get `AsyncIterable<Event>` instead.
 * @param {EventTarget} target
 * @param {string} type
 * @param {AddEventListenerOptions} options
 */
const listen = function (target, type, options) {
  const events = []
  let resume
  let ready = new Promise(resolve => (resume = resolve))

  const write = event => {
    events.push(event)
    resume()
  }

  const read = async () => {
    await ready
    ready = new Promise(resolve => (resume = resolve))
    return events.splice(0)
  }

  const reader = async function * () {
    try {
      while (true) {
        yield * await read()
      }
    } finally {
      target.removeEventListener(type, write, options)
    }
  }

  target.addEventListener(type, write, options)
  return reader()
}


self.addEventListener("message", setup)


function setup(event) {
  if (!self.initiated) main(event.ports && event.ports[0])
  self.removeEventListener("message", setup)
}


if (typeof SharedWorkerGlobalScope === "function") main()
