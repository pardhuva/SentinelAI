const dns = require('dns').promises;
const net = require('net');

/**
 * Checks if an IPv4 or IPv6 address belongs to a prohibited or private network block.
 * Cloud metadata (169.254.169.254) is ALWAYS strictly blocked regardless of flags.
 * 
 * @param {string} ip
 * @param {Object} [options]
 * @param {boolean} [options.allowPrivateTargets=false]
 * @returns {boolean} true if IP is prohibited, false if allowed
 */
function isProhibitedIp(ip, { allowPrivateTargets = false } = {}) {
  if (!ip) return true;

  // Cloud metadata endpoint (AWS, GCP, Azure, DigitalOcean) is NEVER allowed
  if (ip === '169.254.169.254' || ip.startsWith('169.254.')) {
    return true;
  }

  // IPv6 Link-Local
  if (ip.toLowerCase().startsWith('fe80:')) {
    return true;
  }

  // If local private/loopback testing is explicitly permitted (e.g. for local demo target)
  if (allowPrivateTargets) {
    return false;
  }

  // IPv4 Loopback (127.0.0.0/8)
  if (ip.startsWith('127.')) {
    return true;
  }

  // IPv6 Loopback (::1) or Unspecified (::)
  if (ip === '::1' || ip === '::') {
    return true;
  }

  // IPv4 Private Networks
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

  // 0.0.0.0/8 (Broadcast/Current network)
  if (ip.startsWith('0.')) {
    return true;
  }

  // 100.64.0.0/10 (Carrier-Grade NAT)
  if (/^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./.test(ip)) {
    return true;
  }

  // Multicast (224.0.0.0/4) and Reserved (240.0.0.0/4)
  const firstOctet = parseInt(ip.split('.')[0], 10);
  if (!isNaN(firstOctet) && firstOctet >= 224) {
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
  let resolvedIps = [];

  // If hostname is a literal IP address
  if (net.isIP(hostname)) {
    resolvedIps = [hostname];
  } else {
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
  isProhibitedIp,
  validateTargetDestination,
};
