import fs from 'node:fs';
import path from 'node:path';

interface GraphNode {
  id: string;
  type: string;
  label: string;
  module: string;
  file?: string;
  metadata?: Record<string, any>;
}

interface GraphEdge {
  from: string;
  to: string;
  type: string;
  description?: string;
}

interface KnowledgeGraph {
  generatedAt: string;
  stats: {
    totalNodes: number;
    totalEdges: number;
    nodeCounts: Record<string, number>;
    subsystemCount: number;
  };
  subsystems: Record<string, any>;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const graphPath = path.resolve(__dirname, '..', 'knowledge-graph', 'schoolos-graph.json');

if (!fs.existsSync(graphPath)) {
  console.error('❌ Knowledge graph not found. Please run: npm run graph:build');
  process.exit(1);
}

const graph: KnowledgeGraph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === 'help' || command === '--help' || command === '-h') {
  console.log(`
🔍 SchoolOS Knowledge Graph Query Tool
=======================================
Usage:
  npx tsx scripts/graph-query.ts <keyword>           # Search nodes by keyword
  npx tsx scripts/graph-query.ts inspect <nodeId>    # Inspect full node details and connected edges
  npx tsx scripts/graph-query.ts path <from> <to>    # Find connection path between two concepts
  npx tsx scripts/graph-query.ts subsystem <name>    # Show full subsystem summary
  npx tsx scripts/graph-query.ts stats               # Display graph metrics & counts
`);
  process.exit(0);
}

if (command === 'stats') {
  console.log('📊 SchoolOS Knowledge Graph Statistics:');
  console.log(`   Generated: ${graph.generatedAt}`);
  console.log(`   Total Nodes: ${graph.stats.totalNodes}`);
  console.log(`   Total Edges: ${graph.stats.totalEdges}`);
  console.log(`   Subsystems: ${graph.stats.subsystemCount}`);
  console.log('\n   Node Breakdown:');
  for (const [t, c] of Object.entries(graph.stats.nodeCounts)) {
    console.log(`     - ${t.padEnd(15)}: ${c}`);
  }
  process.exit(0);
}

if (command === 'subsystem') {
  const subName = args[1]?.toLowerCase();
  if (!subName) {
    console.log('Available subsystems:', Object.keys(graph.subsystems).join(', '));
    process.exit(0);
  }
  const sub = graph.subsystems[subName];
  if (!sub) {
    console.log(`❌ Subsystem '${subName}' not found. Available:`, Object.keys(graph.subsystems).join(', '));
    process.exit(1);
  }
  console.log(`\n🏛️ Subsystem: ${subName.toUpperCase()}`);
  console.log(`Description: ${sub.description}`);
  console.log(`\nPages (${sub.pages.length}):\n` + sub.pages.map((p: string) => `  - ${p}`).join('\n'));
  console.log(`\nAPI Routes (${sub.apiRoutes.length}):\n` + sub.apiRoutes.map((a: string) => `  - ${a}`).join('\n'));
  console.log(`\nTables (${sub.tables.length}):\n` + sub.tables.map((t: string) => `  - ${t}`).join('\n'));
  console.log(`\nServices (${sub.services.length}):\n` + sub.services.map((s: string) => `  - ${s}`).join('\n'));
  process.exit(0);
}

if (command === 'inspect') {
  const nodeId = args[1];
  if (!nodeId) {
    console.log('Usage: npx tsx scripts/graph-query.ts inspect <nodeId>');
    process.exit(1);
  }
  const node = graph.nodes.find(n => n.id.toLowerCase() === nodeId.toLowerCase() || n.label.toLowerCase() === nodeId.toLowerCase());
  if (!node) {
    console.log(`❌ Node '${nodeId}' not found.`);
    process.exit(1);
  }
  console.log(`\n📌 Node: ${node.label} (${node.id})`);
  console.log(`Type: ${node.type} | Module: ${node.module}`);
  if (node.file) console.log(`File: ${node.file}`);
  if (node.metadata) console.log('Metadata:', JSON.stringify(node.metadata, null, 2));

  const incoming = graph.edges.filter(e => e.to === node.id);
  const outgoing = graph.edges.filter(e => e.from === node.id);

  if (outgoing.length) {
    console.log(`\nOutgoing Connections (${outgoing.length}):`);
    for (const e of outgoing) {
      console.log(`  --> [${e.type}] ${e.to} ${e.description ? `(${e.description})` : ''}`);
    }
  }
  if (incoming.length) {
    console.log(`\nIncoming Connections (${incoming.length}):`);
    for (const e of incoming) {
      console.log(`  <-- [${e.type}] ${e.from} ${e.description ? `(${e.description})` : ''}`);
    }
  }
  process.exit(0);
}

if (command === 'path') {
  const fromTerm = args[1]?.toLowerCase();
  const toTerm = args[2]?.toLowerCase();
  if (!fromTerm || !toTerm) {
    console.log('Usage: npx tsx scripts/graph-query.ts path <fromNode> <toNode>');
    process.exit(1);
  }

  const startNodes = graph.nodes.filter(n => n.id.toLowerCase().includes(fromTerm) || n.label.toLowerCase().includes(fromTerm));
  const targetNodes = graph.nodes.filter(n => n.id.toLowerCase().includes(toTerm) || n.label.toLowerCase().includes(toTerm));

  const startNode = startNodes[0];
  const targetNode = targetNodes[0];

  if (!startNode || !targetNode) {
    console.log(`Could not find nodes matching '${fromTerm}' or '${toTerm}'.`);
    process.exit(1);
  }

  console.log(`\nTracing relationships between '${startNode.label}' and '${targetNode.label}'...`);

  // Direct edge check
  const direct = graph.edges.find(e => 
    (e.from === startNode.id && e.to === targetNode.id) ||
    (e.to === startNode.id && e.from === targetNode.id)
  );

  if (direct) {
    console.log(`[Direct Connection]: ${direct.from} --[${direct.type}]--> ${direct.to} (${direct.description || ''})`);
  } else {
    // 2-hop BFS search
    let found = false;
    for (const e1 of graph.edges) {
      if (e1.from === startNode.id || e1.to === startNode.id) {
        const intermediate = e1.from === startNode.id ? e1.to : e1.from;
        for (const e2 of graph.edges) {
          if ((e2.from === intermediate && e2.to === targetNode.id) ||
              (e2.to === intermediate && e2.from === targetNode.id)) {
            console.log(`[2-Hop Path Found]:\n  1. ${e1.from} --[${e1.type}]--> ${e1.to}\n  2. ${e2.from} --[${e2.type}]--> ${e2.to}`);
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }
    if (!found) {
      console.log(`No direct or 2-hop relationship found between '${startNode.id}' and '${targetNode.id}'.`);
    }
  }
  process.exit(0);
}

// Default search: Search by keyword
const searchTerm = command.toLowerCase();
const matchingNodes = graph.nodes.filter(n => 
  n.id.toLowerCase().includes(searchTerm) ||
  n.label.toLowerCase().includes(searchTerm) ||
  n.module.toLowerCase().includes(searchTerm) ||
  (n.file && n.file.toLowerCase().includes(searchTerm))
);

console.log(`\n🔍 Found ${matchingNodes.length} nodes matching '${searchTerm}':\n`);
for (const n of matchingNodes.slice(0, 30)) {
  console.log(`[${n.type.padEnd(14)}] ${n.label}`);
  console.log(`  ID: ${n.id} | Module: ${n.module} ${n.file ? `| File: ${n.file}` : ''}`);
}
if (matchingNodes.length > 30) {
  console.log(`\n... and ${matchingNodes.length - 30} more matching nodes.`);
}
console.log(`\n💡 Run 'npx tsx scripts/graph-query.ts inspect <ID>' to inspect connections.`);
