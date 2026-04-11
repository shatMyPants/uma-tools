import * as esbuild from 'esbuild';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as http from 'node:http';
import { fileURLToPath } from 'node:url';

import { program, Option } from 'commander';

program
	.option('--debug')
	.addOption(new Option('--serve [port]', 'run development server on [port]').preset(8000).implies({debug: true}));

program.parse();
const options = program.opts();
const port = options.serve;
const serve = port != null;
const debug = !!options.debug;

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dirname, '..');
const datadir = path.join(root, 'umalator-global');

const redirectData = {
	name: 'redirectData',
	setup(build) {
		build.onResolve({filter: /^\.\.?(?:\/uma-skill-tools)?\/data\//}, args => ({
			path: path.join(datadir, args.path.split('/data/')[1])
		}));
		const redirectedFiles = [
			'course_data.json',
			'tracknames.json',
			'skillnames.json',
			'skill_data.json',
			'skill_meta.json'
		];

		redirectedFiles.forEach(file => {
			build.onResolve({filter: new RegExp(`${file.replace('.', '\\.')}$`)}, args => {
				const p = path.join(datadir, file);
				if (debug) console.log(`Resolving ${args.path} to ${p}`);
				return { path: p };
			});
		});

		build.onResolve({filter: /stamina_results.json$/}, args => {
			const p = path.join(dirname, 'stamina_results.json');
			if (debug) console.log(`Resolving ${args.path} to ${p}`);
			return { path: p };
		});
	}
};

const redirectTable = {
	name: 'redirectTable',
	setup(build) {
		build.onResolve({filter: /^@tanstack\//}, args => ({
			path: path.join(root, 'vendor', args.path.slice(10), 'index.ts')
		}));
	}
};

const mockAssertFn = debug ? 'console.assert' : 'function(){}';
const mockAssert = {
	name: 'mockAssert',
	setup(build) {
		build.onResolve({filter: /^node:assert$/}, args => ({
			path: args.path, namespace: 'mockAssert-ns'
		}));
		build.onLoad({filter: /.*/, namespace: 'mockAssert-ns'}, () => ({
			contents: 'module.exports={strict:'+mockAssertFn+'};',
			loader: 'js'
		}));
	}
};

const buildOptions = {
	entryPoints: [{in: 'app.tsx', out: 'bundle'}],
	bundle: true,
	minify: !debug,
	outdir: '.',
	write: !serve,
	define: {CC_DEBUG: debug.toString(), CC_GLOBAL: 'true'},
	external: ['*.ttf'],
	plugins: [redirectData, redirectTable, mockAssert]
};

const MIME_TYPES = {
	'.html': 'text/html; charset=UTF-8',
	'.css': 'text/css',
	'.js': 'text/javascript',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.otf': 'font/otf',
	'.ttf': 'font/ttf',
	'.woff': 'font/woff'
};

const ARTIFACTS = ['bundle.js', 'bundle.css'];

function runServer(ctx, port) {
	const requestCount = new Map(ARTIFACTS.map(f => [f, 0]));
	let buildCount = 0;
	let output = null;

	http.createServer(async (req, res) => {
		try {
			const rawUrl = req.url.split('?')[0];
			const url = rawUrl.endsWith('/') ? rawUrl + 'index.html' : rawUrl;
			const filename = path.basename(url);

			if (ARTIFACTS.indexOf(filename) > -1) {
				const requestN = (requestCount.get(filename) || 0) + 1;
				requestCount.set(filename, requestN);

				if (requestN > buildCount) {
					// Need a new build because some artifact was requested for the Nth time
					buildCount = requestN;
					console.log(`[BUILD] Rebuilding artifacts (Triggered by ${filename} #${requestN})...`);
					output = (async () => {
						try {
							const result = await ctx.rebuild();
							if (result.errors.length > 0) {
								console.error('[BUILD] Errors:', result.errors);
							}
							return new Map(result.outputFiles.map(o => [path.basename(o.path), o.contents]));
						} catch (e) {
							console.error('[BUILD] Failed:', e);
							return new Map();
						}
					})();
				}

				const artifactsMap = await output;
				const artifact = artifactsMap.get(filename);

				if (artifact) {
					console.log(`GET ${req.url} 200 OK (Artifact #${requestN})`);
					res.writeHead(200, {
						'Content-type': MIME_TYPES[path.extname(filename)] || 'application/octet-stream',
						'Content-length': artifact.length,
						'Cache-Control': 'no-cache'
					}).end(artifact);
				} else {
					console.warn(`GET ${req.url} 404 Not Found (Artifact not in build results)`);
					res.writeHead(404).end();
				}
			} else if (url.startsWith('/uma-tools/')) {
				const fp = path.join(root, url.slice(11));
				const exists = await fs.promises.access(fp).then(() => true, () => false);
				if (exists) {
					console.log(`GET ${req.url} 200 OK (Static)`);
					res.writeHead(200, {'Content-type': MIME_TYPES[path.extname(filename)] || 'application/octet-stream'});
					const stream = fs.createReadStream(fp);
					stream.on('error', err => {
						console.error(`[SERVER] Stream error for ${fp}:`, err);
						if (!res.headersSent) res.writeHead(500).end();
						else res.end();
					});
					stream.pipe(res);
				} else {
					console.log(`GET ${req.url} 404 Not Found (Static)`)
					res.writeHead(404).end();
				}
			} else {
				const fp = path.join(dirname, filename === 'index.html' ? 'index.html' : url.slice(1));
				const exists = await fs.promises.access(fp).then(() => true, () => false);

				if (exists) {
					console.log(`GET ${req.url} 200 OK`);
					res.writeHead(200, {'Content-type': MIME_TYPES[path.extname(filename)] || 'application/octet-stream'});
					const stream = fs.createReadStream(fp);
					stream.on('error', err => {
						console.error(`[SERVER] Stream error for ${fp}:`, err);
						if (!res.headersSent) res.writeHead(500).end();
						else res.end();
					});
					stream.pipe(res);
				} else {
					console.log(`GET ${req.url} 404 Not Found`)
					res.writeHead(404).end();
				}
			}
		} catch (e) {
			console.error(`[SERVER] Unhandled error:`, e);
			if (!res.headersSent) {
				res.writeHead(500).end('Internal Server Error');
			} else {
				res.end();
			}
		}
	}).listen(port);
}

if (serve) {
	const ctx = await esbuild.context(buildOptions);
	runServer(ctx, port);
	console.log(`Serving on http://[::]:${port}/ ...`);
} else {
	await esbuild.build(buildOptions);
}
