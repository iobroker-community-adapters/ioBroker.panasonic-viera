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

const URL_CONTROL_NRC = '/nrc/control_0';
const URN_REMOTE_CONTROL = 'panasonic-com:service:p00NetworkControl:1';

/** The TV answers errors with a SOAP fault (HTTP 500), which node-panasonic-viera resolves like a success */
function throwOnFault(action: string, answer: string | undefined): string {
    const text = answer || '';
    const fault = /<errorDescription>([^<]*)<\/errorDescription>/.exec(text);
    if (fault || text.includes('s:Fault')) {
        throw new Error(`${action}: the TV refused it: ${fault?.[1] || 'unknown error'}`);
    }
    return text;
}

/**
 * Starts an app by its product ID (e.g. YouTube `0070000200180001`). Replacement for `viera.sendAppCommand()`:
 * in node-panasonic-viera 0.4.1 it sends malformed XML (`<X_AppType>vc_app<X_AppType>`).
 * Same request as `launch_app()` of the Python library panasonic-viera; encrypted TVs get it encrypted by
 * `_soap_request` like every other remote control command.
 */
export async function launchApp(viera: Viera, productId: string): Promise<void> {
    if (!/^[0-9A-Fa-f]{16}$/.test(productId)) {
        throw new Error(`Invalid product ID ${productId}`);
    }
    throwOnFault(
        'X_LaunchApp',
        await viera.private._soap_request(
            URL_CONTROL_NRC,
            URN_REMOTE_CONTROL,
            'X_LaunchApp',
            `<X_AppType>vc_app</X_AppType><X_LaunchKeyword>product_id=${productId}</X_LaunchKeyword>`,
        ),
    );
}

/**
 * The apps installed on the TV (`X_GetAppList`, like `get_apps()` of the Python library panasonic-viera).
 * The list is one string: `vc_app'product_id=<id>'<name>'<icon url>'...` with `'` escaped as `&apos;`.
 */
export async function getAppList(viera: Viera): Promise<{ name: string; productId: string }[]> {
    const answer = throwOnFault(
        'X_GetAppList',
        await viera.private._soap_request(URL_CONTROL_NRC, URN_REMOTE_CONTROL, 'X_GetAppList', ''),
    );
    const apps: { name: string; productId: string }[] = [];
    const regex = /vc_app(?:&apos;|')product_id=([0-9A-Fa-f]{16})(?:&apos;|')(.*?)(?:&apos;|')/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(answer))) {
        apps.push({ productId: match[1], name: match[2].replace(/&amp;/g, '&').trim() });
    }
    return apps;
}
