import type { Viera } from 'node-panasonic-viera';

/**
 * Replacement for `viera.getMute()`: in node-panasonic-viera 0.4.1 it does not pass a failed request on - the
 * returned promise never settles and the error ends up as unhandled rejection, which stops the adapter.
 * This is the same request with proper error handling.
 */
export async function getMute(viera: Viera): Promise<boolean> {
    const data = await viera.private._soap_request(
        '/dmr/control_0',
        'schemas-upnp-org:service:RenderingControl:1',
        'GetMute',
        '<InstanceID>0</InstanceID><Channel>Master</Channel>',
    );
    const match = /<CurrentMute>([01])<\/CurrentMute>/.exec(data || '');
    if (!match) {
        throw new Error('No data found');
    }
    return match[1] === '1';
}
