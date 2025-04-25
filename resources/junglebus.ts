import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Main JungleBus API documentation URL
const JUNGLEBUS_DOCS_URL = "https://junglebus.gorillapool.io/docs/";

/**
 * Manually structured JungleBus API documentation
 * Provides a clean summary of key JungleBus API endpoints and functionality
 */
export function getJungleBusDocumentation(): string {
	return `# JungleBus API Documentation

## Overview

JungleBus is a transaction monitoring service for Bitcoin SV that allows applications to subscribe to transaction events and filter them based on specific criteria. The API provides both subscription and querying capabilities.

## API Endpoints

### Base URL
\`\`\`
https://junglebus.gorillapool.io/v1
\`\`\`

### Transaction API

#### Get Transaction by ID
\`\`\`
GET /transaction/get/{txid}
\`\`\`

Returns detailed information about a specific transaction, including:
- Transaction data (hex format)
- Block information (hash, height, time)
- Input and output details
- Address information

#### Get Transactions by Block Hash
\`\`\`
GET /block/{blockhash}/transactions
\`\`\`

Returns all transactions within a specific block.

### Subscription API

#### Create Subscription
\`\`\`
POST /subscribe
\`\`\`

Create a new subscription to monitor transactions based on filtering criteria.

Example request body:
\`\`\`json
{
  "callback": "https://your-callback-url.com",
  "fromBlock": 0,
  "query": {
    "find": {
      "out.tape.cell.s": "BEEF"
    }
  }
}
\`\`\`

#### Delete Subscription
\`\`\`
DELETE /subscribe/{id}
\`\`\`

Deletes an existing subscription.

### Network API

#### Get Network Info
\`\`\`
GET /network/info
\`\`\`

Returns current blockchain network information, including block height and other statistics.

## Client Implementations

### TypeScript Client

Installation:
\`\`\`bash
$ npm install @gorillapool/js-junglebus
\`\`\`

Usage:
\`\`\`javascript
import { JungleBusClient } from '@gorillapool/js-junglebus';

const server = "junglebus.gorillapool.io";
const jungleBusClient = new JungleBusClient(server, {
  onConnected(ctx) {
    // add your own code here
    console.log(ctx);
  },
  onConnecting(ctx) {
    // add your own code here
    console.log(ctx);
  },
  onDisconnected(ctx) {
    // add your own code here
    console.log(ctx);
  },
  onError(ctx) {
    // add your own code here
    console.error(ctx);
  }
});

// create subscriptions in the dashboard of the JungleBus website
const subId = "...."; // fill in the ID for the subscription
const fromBlock = 750000;

const subscription = jungleBusClient.Subscribe(
  subId,
  fromBlock,
  onPublish(tx) => {
    // add your own code here
    console.log(tx);
  },
  onStatus(ctx) => {
    // add your own code here
    console.log(ctx);
  },
  onError(ctx) => {
    // add your own code here
    console.log(ctx);
  },
  onMempool(tx) => {
    // add your own code here
    console.log(tx);
  }
);

// For lite mode (transaction hash and block height only)
await client.Subscribe("a5e2fa655c41753331539a2a86546bf9335ff6d9b7a512dc9acddb00ab9985c0", 1550000, onPublish, onStatus, onError, onMempool, true);
\`\`\`

### Go Client

Installation:
\`\`\`bash
go get github.com/GorillaPool/go-junglebus
\`\`\`

Usage:
\`\`\`go
package main

import (
  "context"
  "log"
  "sync"
  "github.com/GorillaPool/go-junglebus"
  "github.com/GorillaPool/go-junglebus/models"
)

func main() {
  wg := &sync.WaitGroup{}
  
  junglebusClient, err := junglebus.New(
    junglebus.WithHTTP("https://junglebus.gorillapool.io"),
  )
  if err != nil {
    log.Fatalln(err.Error())
  }
  
  subscriptionID := "..." // fill in the ID for the subscription
  fromBlock := uint64(750000)
  
  eventHandler := junglebus.EventHandler{
    // do not set this function to leave out mined transactions
    OnTransaction: func(tx *models.TransactionResponse) {
      log.Printf("[TX]: %d: %v", tx.BlockHeight, tx.Id)
    },
    // do not set this function to leave out mempool transactions
    OnMempool: func(tx *models.TransactionResponse) {
      log.Printf("[MEMPOOL TX]: %v", tx.Id)
    },
    OnStatus: func(status *models.ControlResponse) {
      log.Printf("[STATUS]: %v", status)
    },
    OnError: func(err error) {
      log.Printf("[ERROR]: %v", err)
    },
  }
  
  var subscription *junglebus.Subscription
  if subscription, err = junglebusClient.Subscribe(context.Background(), subscriptionID, fromBlock, eventHandler); err != nil {
    log.Printf("ERROR: failed getting subscription %s", err.Error())
  }
  
  // For lite mode
  if subscription, err := junglebusClient.SubscribeWithQueue(context.Background(), subscriptionID, fromBlock, 0, eventHandler, &junglebus.SubscribeOptions{
    QueueSize: 100000,
    LiteMode: true,
  }); err != nil {
    log.Printf("ERROR: failed getting subscription %s", err.Error())
  }
  
  wg.Add(1)
  wg.Wait()
}
\`\`\`

## Further Reading

For complete API documentation, visit [JungleBus Docs](${JUNGLEBUS_DOCS_URL})
`;
}

/**
 * Register the JungleBus API documentation resource with the MCP server
 * @param server The MCP server instance
 */
export function registerJungleBusResource(server: McpServer): void {
	server.resource(
		"junglebus-api-docs",
		JUNGLEBUS_DOCS_URL,
		{
			title: "JungleBus API Documentation",
			description:
				"API documentation for JungleBus, a transaction monitoring service for Bitcoin SV",
		},
		async (uri) => {
			const documentationContent = getJungleBusDocumentation();
			return {
				contents: [
					{
						uri: uri.href,
						text: documentationContent,
					},
				],
			};
		},
	);
}
