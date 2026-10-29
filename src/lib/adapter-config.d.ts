// Augments the globally declared ioBroker types with everything this adapter adds.
// Keep in sync with `native` in io-package.json and with admin/jsonConfig.json.
declare global {
    namespace ioBroker {
        interface AdapterConfig {
            /** IP address of the TV, e.g. 192.168.1.20 */
            ip: string;
            /** Application ID for encrypted TVs (2018+), empty for older TVs. Stored in plain text in native. */
            app_id: string;
            /** Encryption key for encrypted TVs (2018+), empty for older TVs. Stored in plain text in native. */
            encryption_key: string;
        }
    }
}

export {};
