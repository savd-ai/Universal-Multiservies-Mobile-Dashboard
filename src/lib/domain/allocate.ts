export function largestRemainder(馌壍: number, 晻壍: readonly number[], 蕪壍 = 0): number[] {
    const 剙壍 = 晻壍.length;
    if (剙壍 === 0)
        return [];
    const 煈壍 = 10 ** 蕪壍;
    const 逷壍 = Math.round(馌壍 * 煈壍);
    const 崦壍 = 晻壍.reduce((簕壍, 鬄壍) => 簕壍 + Math.max(0, 鬄壍), 0);
    if (崦壍 <= 0 || 逷壍 === 0) {
        const 柳壍 = new Array<number>(剙壍).fill(0);
        柳壍[0] = 逷壍 / 煈壍;
        return 柳壍;
    }
    const 蛢壍 = 晻壍.map((发壍) => (Math.max(0, 发壍) / 崦壍) * 逷壍);
    const 狀壍 = 蛢壍.map((醯壍) => Math.floor(醯壍));
    let 庞壍 = 逷壍 - 狀壍.reduce((綍壍, 鱼壍) => 綍壍 + 鱼壍, 0);
    const 楫壍 = 蛢壍.map((衚壍, 啉壍) => ({ i: 啉壍, frac: 衚壍 - Math.floor(衚壍) })).sort((琸壍, 錧壍) => 錧壍.frac - 琸壍.frac || 琸壍.i - 錧壍.i);
    for (let 怖壍 = 0; 怖壍 < 楫壍.length && 庞壍 > 0; 怖壍++, 庞壍--) {
        const 缅壍 = (楫壍[怖壍] as {
            i: number;
        }).i;
        狀壍[缅壍] = (狀壍[缅壍] as number) + 1;
    }
    return 狀壍.map((鷴壍) => 鷴壍 / 煈壍);
}
export function roundPreservingTotal(櫣壍: readonly number[], 角壍: number, 囁壍?: number): number[] {
    if (櫣壍.length === 0)
        return [];
    const 疰壍 = Math.round((囁壍 ?? 櫣壍.reduce((钟壍, 憎壍) => 钟壍 + 憎壍, 0)) / 角壍);
    const 聽壍 = 櫣壍.map((齬壍) => 齬壍 / 角壍);
    const 汛壍 = 聽壍.map((譊壍) => Math.floor(譊壍));
    let 堹壍 = 疰壍 - 汛壍.reduce((眨壍, 阗壍) => 眨壍 + 阗壍, 0);
    const 挆壍 = 聽壍.map((臵壍, 令壍) => ({ i: 令壍, frac: 臵壍 - Math.floor(臵壍) })).sort((淓壍, 賂壍) => 賂壍.frac - 淓壍.frac || 淓壍.i - 賂壍.i);
    let 妱壍 = 0;
    while (堹壍 > 0 && 挆壍.length) {
        const 碠壍 = (挆壍[妱壍 % 挆壍.length] as {
            i: number;
        }).i;
        汛壍[碠壍] = (汛壍[碠壍] as number) + 1;
        堹壍--;
        妱壍++;
    }
    妱壍 = 挆壍.length - 1;
    while (堹壍 < 0 && 挆壍.length) {
        const 鞏壍 = (挆壍[((妱壍 % 挆壍.length) + 挆壍.length) % 挆壍.length] as {
            i: number;
        }).i;
        if ((汛壍[鞏壍] as number) > 0) {
            汛壍[鞏壍] = (汛壍[鞏壍] as number) - 1;
            堹壍++;
        }
        妱壍--;
        if (妱壍 < -挆壍.length * 4)
            break;
    }
    return 汛壍.map((摾壍) => 摾壍 * 角壍);
}
