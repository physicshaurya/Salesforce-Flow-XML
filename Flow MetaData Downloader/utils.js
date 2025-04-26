function extractNonNullProperties(obj) {
    if (Array.isArray(obj)) {
        return obj.map(extractNonNullProperties).filter(item => item !== null && Object.keys(item).length > 0);
    } else if (typeof obj === 'object' && obj !== null) {
        return Object.entries(obj).reduce((acc, [key, value]) => {
            const cleanedValue = extractNonNullProperties(value);
            if (cleanedValue !== null && (typeof cleanedValue !== 'object' || Object.keys(cleanedValue).length > 0)) {
                acc[key] = cleanedValue;
            }
            return acc;
        }, {});
    }
    return obj !== null ? obj : null;
}

