import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { request } from 'node:http';

/**
 * PIN pairing of encrypted (2019+) Panasonic TVs: the TV shows a PIN, the PIN is sent back encrypted with a key
 * derived from the challenge of the TV, and the TV answers with the Application ID and the Encryption Key that
 * node-panasonic-viera needs for `connect()`. node-panasonic-viera can only show the PIN, so this is a port of
 * `request_pin_code()` / `authorize_pin_code()` of the Python library panasonic-viera
 * (https://github.com/florianholzapfel/panasonic-viera, remote_control.py).
 */

const PORT = 55000;
const URL_CONTROL_NRC = '/nrc/control_0';
const URN_REMOTE_CONTROL = 'panasonic-com:service:p00NetworkControl:1';
const TIMEOUT = 5000;

/** HMAC key mask (taken by the Python library from libtvconnect.so) */
const HMAC_KEY_MASK = [
    0x15, 0xc9, 0x5a, 0xc2, 0xb0, 0x8a, 0xa7, 0xeb, 0x4e, 0x22, 0x8f, 0x81, 0x1e, 0x34, 0xd0, 0x4f, 0xa5, 0x4b, 0xa7,
    0xdc, 0xac, 0x98, 0x79, 0xfa, 0x8a, 0xcd, 0xa3, 0xfc, 0x24, 0x4f, 0x38, 0x54,
];

export interface PairingResult {
    appId: string;
    encryptionKey: string;
}

/** An error the TV reported, e.g. `Invalid PIN code` */
export class PairingError extends Error {}

function escapeXml(text: string): string {
    return text.replace(/[<>&'"]/g, c => `&#${c.charCodeAt(0)};`);
}

function xmlValue(xml: string, tag: string): string | null {
    const match = new RegExp(`<(?:\\w+:)?${tag}>([^<]*)</(?:\\w+:)?${tag}>`).exec(xml);
    return match ? match[1] : null;
}

/** POST a SOAP action to the remote control service of the TV, rejects with PairingError on a SOAP fault */
function soapRequest(host: string, action: string, params: string): Promise<string> {
    const body =
        '<?xml version="1.0" encoding="utf-8"?>' +
        '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"' +
        ' s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' +
        '<s:Body>' +
        `<u:${action} xmlns:u="urn:${URN_REMOTE_CONTROL}">${params}</u:${action}>` +
        '</s:Body>' +
        '</s:Envelope>';

    return new Promise((resolve, reject) => {
        const req = request(
            {
                host,
                port: PORT,
                path: URL_CONTROL_NRC,
                method: 'POST',
                timeout: TIMEOUT,
                headers: {
                    'Content-Length': Buffer.byteLength(body),
                    'Content-Type': 'text/xml; charset=utf-8',
                    SOAPAction: `"urn:${URN_REMOTE_CONTROL}#${action}"`,
                },
            },
            res => {
                let data = '';
                res.setEncoding('utf8');
                res.on('data', chunk => (data += chunk));
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(data);
                        return;
                    }
                    if (res.statusCode === 500) {
                        // SOAP fault: error code 600 is the answer to a wrong PIN
                        if (action === 'X_RequestAuth' && xmlValue(data, 'errorCode') === '600') {
                            reject(new PairingError('Invalid PIN code'));
                            return;
                        }
                        const description = xmlValue(data, 'errorDescription');
                        if (description) {
                            reject(new PairingError(description));
                            return;
                        }
                    }
                    reject(new Error(`${action}: the TV answered with status ${res.statusCode}`));
                });
            },
        );
        req.on('timeout', () => req.destroy(new Error(`${action}: the TV does not answer`)));
        req.on('error', reject);
        req.end(body);
    });
}

/** AES key and HMAC key for the pairing, derived from the challenge (= IV) of the TV */
export function deriveKeys(challenge: Buffer): { key: Buffer; hmacKey: Buffer } {
    const key = Buffer.alloc(16);
    for (let i = 0; i < 16; i += 4) {
        key[i] = ~challenge[i + 3] & 0xff;
        key[i + 1] = ~challenge[i + 2] & 0xff;
        key[i + 2] = ~challenge[i + 1] & 0xff;
        key[i + 3] = ~challenge[i] & 0xff;
    }
    const hmacKey = Buffer.alloc(32);
    for (let i = 0; i < 32; i += 4) {
        hmacKey[i] = HMAC_KEY_MASK[i] ^ challenge[(i + 2) & 0xf];
        hmacKey[i + 1] = HMAC_KEY_MASK[i + 1] ^ challenge[(i + 3) & 0xf];
        hmacKey[i + 2] = HMAC_KEY_MASK[i + 2] ^ challenge[i & 0xf];
        hmacKey[i + 3] = HMAC_KEY_MASK[i + 3] ^ challenge[(i + 1) & 0xf];
    }
    return { key, hmacKey };
}

/** 12 random bytes + length (big endian) + data, zero padded, AES-128-CBC, followed by HMAC-SHA-256 */
export function encryptPayload(data: string, key: Buffer, iv: Buffer, hmacKey: Buffer): string {
    const length = Buffer.alloc(4);
    const plain = Buffer.from(data, 'latin1');
    length.writeUInt32BE(plain.length, 0);
    let payload = Buffer.concat([randomBytes(12), length, plain]);
    // zero padding like the Python library (it pads even if the length is a multiple of the block size)
    payload = Buffer.concat([payload, Buffer.alloc(16 - (payload.length % 16))]);

    const aes = createCipheriv('aes-128-cbc', key, iv);
    aes.setAutoPadding(false);
    const ciphertext = Buffer.concat([aes.update(payload), aes.final()]);
    const sig = createHmac('sha256', hmacKey).update(ciphertext).digest();
    return Buffer.concat([ciphertext, sig]).toString('base64');
}

/** Counterpart of encryptPayload: the data begins after the 16 byte header and ends at the first zero byte */
export function decryptPayload(data: string, key: Buffer, iv: Buffer): string {
    const raw = Buffer.from(data, 'base64');
    // the TV appends the HMAC (32 bytes) as well, only whole blocks are decrypted
    const aes = createDecipheriv('aes-128-cbc', key, iv);
    aes.setAutoPadding(false);
    const decrypted = aes.update(raw.subarray(0, raw.length - (raw.length % 16)));
    const end = decrypted.indexOf(0, 16);
    return decrypted.toString('latin1', 16, end === -1 ? decrypted.length : end);
}

/**
 * Lets the TV show a PIN
 *
 * @param host IP address of the TV
 * @param name name of the remote control shown on the TV
 * @returns the challenge of the TV, needed for `authorizePinCode()`
 */
export async function requestPinCode(host: string, name: string): Promise<Buffer> {
    const response = await soapRequest(host, 'X_DisplayPinCode', `<X_DeviceName>${escapeXml(name)}</X_DeviceName>`);
    const challenge = xmlValue(response, 'X_ChallengeKey');
    if (!challenge) {
        throw new Error('The TV did not send a challenge key - maybe it does not need pairing');
    }
    return Buffer.from(challenge, 'base64');
}

/** Sends the PIN shown on the TV and returns the Application ID and the Encryption Key */
export async function authorizePinCode(host: string, challenge: Buffer, pin: string): Promise<PairingResult> {
    const { key, hmacKey } = deriveKeys(challenge);
    const authInfo = encryptPayload(`<X_PinCode>${escapeXml(pin)}</X_PinCode>`, key, challenge, hmacKey);
    const response = await soapRequest(host, 'X_RequestAuth', `<X_AuthInfo>${authInfo}</X_AuthInfo>`);

    const authResult = xmlValue(response, 'X_AuthResult');
    if (!authResult) {
        throw new Error('The TV did not send an authorization result');
    }
    const decrypted = decryptPayload(authResult, key, challenge);
    const appId = xmlValue(decrypted, 'X_ApplicationId');
    const encryptionKey = xmlValue(decrypted, 'X_Keyword');
    if (!appId || !encryptionKey) {
        throw new Error('The authorization result of the TV contains no Application ID or Encryption Key');
    }
    return { appId, encryptionKey };
}
