/**
 * Shared helpers for FastPDF k6 load tests.
 */

export function resolveFixturePath(filePath, fixturesDir) {
    if (!fixturesDir || filePath.startsWith('/')) {
        return filePath;
    }

    const dir = fixturesDir.replace(/\/+$/, '');
    return `${dir}/${filePath}`;
}

export function fixturePathCandidates(entry, fixturesDir) {
    const basePath = resolveFixturePath(entry, fixturesDir);
    const candidates = [basePath];

    // k6 resolves open() paths relative to the calling script location.
    // Also try project-root-relative form when users pass paths like ./scripts/html/....
    if (!basePath.startsWith('/') && !basePath.startsWith('../')) {
        candidates.push(`../${basePath}`);
    }

    return candidates;
}

export function openFirstAvailable(entry, fixturesDir) {
    const candidates = fixturePathCandidates(entry, fixturesDir);
    let lastError = '';

    for (const candidate of candidates) {
        try {
            return open(candidate);
        } catch (error) {
            lastError = String(error);
        }
    }

    throw new Error(
        `Failed to load HTML fixture: ${entry}. Tried ${candidates.join(', ')}. ${lastError}`,
    );
}

export function loadHtmlTemplates(defaultFixture, fixtureFiles, fixturesDir) {
    if (fixtureFiles.length === 0) {
        return [defaultFixture];
    }

    return fixtureFiles.map((entry) => openFirstAvailable(entry, fixturesDir));
}

export function materializeHtml(template, marker) {
    const withMarker = template
        .replace(/VU_PLACEHOLDER/g, marker)
        .replace(/\{\{VU\}\}/g, marker);

    if (withMarker !== template) {
        return withMarker;
    }

    return `${template}\n<!-- k6-doc-id:${marker} -->`;
}

export function getHeaderValue(headers, headerName) {
    if (!headers) {
        return '';
    }

    const direct = headers[headerName];
    if (typeof direct === 'string') {
        return direct;
    }

    const lower = headers[headerName.toLowerCase()];
    if (typeof lower === 'string') {
        return lower;
    }

    const upper = headers[headerName.toUpperCase()];
    if (typeof upper === 'string') {
        return upper;
    }

    return '';
}