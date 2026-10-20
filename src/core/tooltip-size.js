export const TOOLTIP_SIZES=Object.freeze({small:300,medium:380,large:480});
export const validTooltipSize=value=>typeof value==='string' && Object.hasOwn(TOOLTIP_SIZES,value);
