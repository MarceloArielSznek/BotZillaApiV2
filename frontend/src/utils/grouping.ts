export const groupByCategory = (groups: any[]) => {
    return groups.reduce((acc, group) => {
        const categoryName = group.category?.name || 'Uncategorized';
        if (!acc[categoryName]) {
            acc[categoryName] = [];
        }
        acc[categoryName].push(group);
        return acc;
    }, {} as Record<string, any[]>);
};
