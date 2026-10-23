const dns = require('dns').promises;
const net = require('net');

/**
 * Normalizes an IP string by stripping enclosing brackets, zone IDs,
 * and unpacking IPv4-mapped IPv6 representations.
 *
 * @param {string} rawIp
 * @returns {{ ip: string, family: number, isMappedIpv4: boolean }}
 */
function normalizeIp(rawIp) {
  if (!rawIp || typeof rawIp !== 'string') {
    return { ip: '', family: 0, isMappedIpv4: false };
  }

  let clean = rawIp.trim().toLowerCase();

  // Strip enclosing brackets for IPv6 literals e.g. [::1]
  if (clean.startsWith('[') && clean.endsWith(']')) {
    clean = clean.slice(1, -1);
  }

  // Strip zone ID e.g. fe80::1%eth0
  const zoneIndex = clean.indexOf('%');
  if (zoneIndex !== -1) {
    clean = clean.substring(0, zoneIndex);
  }

  // Detect and unpack IPv4-mapped IPv6 address (::ffff:w.x.y.z or ::ffff:hhhh:hhhh)
  const mappedIpv4Match = clean.match(/^(?:::ffff:|(?:0+:){5}ffff:)(.+)$/i);
  if (mappedIpv4Match) {
    const remainder = mappedIpv4Match[1];
    // Check if remainder is standard dot-decimal IPv4
    if (net.isIPv4(remainder)) {
      return { ip: remainder, family: 4, isMappedIpv4: true };
    }
    // Check if remainder is two hex words e.g. 7f00:1 or a9fe:a9fe
    const hexParts = remainder.split(':');
    if (hexParts.length === 2) {
      const high = parseInt(hexParts[0], 16);
      const low = parseInt(hexParts[1], 16);
      if (!isNaN(high) && !isNaN(low)) {
        const octet1 = (high >> 8) & 0xff;
        const octet2 = high & 0xff;
        const octet3 = (low >> 8) & 0xff;
        const octet4 = low & 0xff;
        const unpackedIpv4 = `${octet1}.${octet2}.${octet3}.${octet4}`;
        if (net.isIPv4(unpackedIpv4)) {
          return { ip: unpackedIpv4, family: 4, isMappedIpv4: true };
        }
      }
    }
  }

  const family = net.isIP(clean);
  return { ip: clean, family, isMappedIpv4: false };
}

/**
 * Checks if an IPv4 or IPv6 address belongs to a prohibited or private network block.
 * Cloud metadata endpoints are ALWAYS strictly blocked regardless of flags.
 *
 * @param {string} rawIp
 * @param {Object} [options]
 * @param {boolean} [options.allowPrivateTargets=false]
 * @returns {boolean} true if IP is prohibited, false if allowed
 */
function isProhibitedIp(rawIp, { allowPrivateTargets = false } = {}) {
  const { ip, family } = normalizeIp(rawIp);
  if (!ip || family === 0) {
    return true; // Malformed or invalid IP is treated as prohibited
  }

  // ==========================================
  // IPv4 Checks
  // ==========================================
  if (family === 4) {
    // 1. Cloud metadata addresses (ALWAYS strictly prohibited)
    // AWS/GCP/Azure/Oracle/DO link-local metadata (169.254.0.0/16)
    if (ip.startsWith('169.254.')) {
      return true;
    }
    // Alibaba Cloud metadata service (100.100.100.200)
    if (ip === '100.100.100.200') {
      return true;
    }

    // If private/loopback testing is explicitly permitted in development mode
    if (allowPrivateTargets) {
      return false;
    }

    // 2. IPv4 Loopback (127.0.0.0/8)
    if (ip.startsWith('127.')) {
      return true;
    }

    // 3. Current network / broadcast (0.0.0.0/8)
    if (ip.startsWith('0.')) {
      return true;
    }

    // 4. RFC 1918 Private Address Blocks
    // 10.0.0.0/8
    if (ip.startsWith('10.')) {
      return true;
    }

    // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) {
      return true;
    }

    // 192.168.0.0/16
    if (ip.startsWith('192.168.')) {
      return true;
    }

    // 5. Carrier-Grade NAT (100.64.0.0/10: 100.64.0.0 - 100.127.255.255)
    if (/^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./.test(ip)) {
      return true;
    }

    // 6. IETF Protocol Assignments (192.0.0.0/24)
    if (ip.startsWith('192.0.0.')) {
      return true;
    }

    // 7. Network Interconnect Benchmark Testing (198.18.0.0/15: 198.18.0.0 - 198.19.255.255)
    if (/^198\.(18|19)\./.test(ip)) {
      return true;
    }

    // 8. Documentation / Test Networks (TEST-NET-1, 2, 3)
    if (ip.startsWith('192.0.2.') || ip.startsWith('198.51.100.') || ip.startsWith('203.0.113.')) {
      return true;
    }

    // 9. Multicast (224.0.0.0/4), Reserved (240.0.0.0/4), and Limited Broadcast (255.255.255.255)
    const firstOctet = parseInt(ip.split('.')[0], 10);
    if (!isNaN(firstOctet) && firstOctet >= 224) {
      return true;
    }

    return false;
  }

  // ==========================================
  // IPv6 Checks
  // ==========================================
  if (family === 6) {
    // 1. Cloud metadata endpoints (ALWAYS strictly prohibited)
    // AWS IMDSv2 IPv6 metadata address (fd00:ec2::254)
    if (ip === 'fd00:ec2::254' || ip.startsWith('fd00:ec2:')) {
      return true;
    }

    // 2. IPv6 Link-Local (fe80::/10: fe80: to febf:) — ALWAYS prohibited
    if (/^fe[89ab][0-9a-f]:/i.test(ip) || ip.startsWith('fe80:')) {
      return true;
    }

    // If private/loopback testing is explicitly permitted in development mode
    if (allowPrivateTargets) {
      return false;
    }

    // 3. IPv6 Loopback (::1) or Unspecified (::)
    if (ip === '::1' || ip === '::' || ip === '0:0:0:0:0:0:0:1' || ip === '0:0:0:0:0:0:0:0') {
      return true;
    }

    // 4. IPv6 Unique Local Address / ULA (fc00::/7: fc00: to fdff:)
    if (/^f[cd][0-9a-f]{2}:/i.test(ip)) {
      return true;
    }

    // 5. IPv6 Site-Local (fec0::/10, deprecated RFC 3879)
    if (/^fec[0-9a-f]:/i.test(ip)) {
      return true;
    }

    // 6. IPv6 Discard Prefix (0100::/64)
    if (ip.startsWith('100:') || ip.startsWith('0100:')) {
      return true;
    }

    // 7. IPv6 Documentation Prefix (2001:db8::/32)
    if (ip.startsWith('2001:db8:') || ip.startsWith('2001:0db8:')) {
      return true;
    }

    // 8. IPv6 Multicast (ff00::/8)
    if (ip.startsWith('ff')) {
      return true;
    }

    return false;
  }

  return true;
}

/**
 * Checks if a hostname directly matches prohibited internal or cloud metadata domains.
 *
 * @param {string} hostname
 * @param {Object} [options]
 * @param {boolean} [options.allowPrivateTargets=false]
 * @returns {boolean} true if hostname is prohibited
 */
function isProhibitedHostname(hostname, { allowPrivateTargets = false } = {}) {
  if (!hostname || typeof hostname !== 'string') return true;

  const cleanHost = hostname.trim().toLowerCase();

  // 1. Cloud metadata domain names (ALWAYS prohibited)
  if (
    cleanHost === 'metadata.google.internal' ||
    cleanHost === 'instance-data' ||
    cleanHost === 'metadata.internal' ||
    cleanHost === '169.254.169.254'
  ) {
    return true;
  }

  if (allowPrivateTargets) {
    return false;
  }

  // 2. Loopback and internal hostnames
  if (
    cleanHost === 'localhost' ||
    cleanHost === 'localhost.localdomain' ||
    cleanHost.endsWith('.localhost') ||
    cleanHost.endsWith('.local') ||
    cleanHost.endsWith('.internal') ||
    cleanHost.endsWith('.lan') ||
    cleanHost.endsWith('.home') ||
    cleanHost.endsWith('.corp') ||
    cleanHost.endsWith('.intranet')
  ) {
    return true;
  }

  return false;
}

/**
 * Validates that an outbound target URL is safe from SSRF attacks.
 * Resolves hostnames via DNS and checks all resulting IP addresses.
 *
 * @param {string} urlString
 * @param {Object} [options]
 * @param {boolean} [options.allowPrivateTargets=false]
 * @returns {Promise<{ valid: boolean, parsedUrl: URL, resolvedIps: string[] }>}
 */
async function validateTargetDestination(urlString, options = {}) {
  let parsedUrl;
  try {
    parsedUrl = new URL(urlString);
  } catch (err) {
    throw new Error(`SSRF Protection: Malformed target URL "${urlString}". ${err.message}`);
  }

  // Protocol check: only http and https are permitted
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error(
      `SSRF Protection: Prohibited protocol "${parsedUrl.protocol}". Only http: and https: are allowed.`
    );
  }

  const hostname = parsedUrl.hostname;
  const normalized = normalizeIp(hostname);

  let resolvedIps = [];

  // Check if hostname is an IP literal (IPv4 or IPv6)
  if (normalized.family !== 0) {
    if (isProhibitedIp(normalized.ip, options)) {
      throw new Error(
        `SSRF Protection Violation: Target destination "${hostname}" resolved to prohibited IP address "${normalized.ip}". Access to private or metadata addresses is blocked.`
      );
    }
    resolvedIps = [normalized.ip];
  } else {
    // Pre-resolution hostname blocklist check
    if (isProhibitedHostname(hostname, options)) {
      throw new Error(
        `SSRF Protection Violation: Hostname "${hostname}" is prohibited (metadata or private name).`
      );
    }
    // Resolve hostname via DNS
    try {
      const records = await dns.lookup(hostname, { all: true });
      resolvedIps = records.map((r) => r.address);
    } catch (dnsErr) {
      throw new Error(`SSRF Protection: Failed to resolve target host "${hostname}": ${dnsErr.message}`);
    }
  }

  if (resolvedIps.length === 0) {
    throw new Error(`SSRF Protection: No IP address resolved for host "${hostname}".`);
  }

  // Check all resolved IPs against prohibited ranges
  for (const ip of resolvedIps) {
    if (isProhibitedIp(ip, options)) {
      throw new Error(
        `SSRF Protection Violation: Target destination "${hostname}" resolved to prohibited IP address "${ip}". Access to private or metadata addresses is blocked.`
      );
    }
  }

  return {
    valid: true,
    parsedUrl,
    resolvedIps,
  };
}

module.exports = {
  normalizeIp,
  isProhibitedIp,
  isProhibitedHostname,
  validateTargetDestination,
};
