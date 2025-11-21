import React from 'react';

export type GQClue = {
  catIdx: number;
  clueIdx: number;
  label: string; // usually points like 100/200/...
  taken?: boolean;
};

type Props = {
  categories: string[];
  grid: GQClue[][]; // categories x levels
  onSelect?: (catIdx: number, clueIdx: number) => void;
  readOnly?: boolean;
};

const GridQuestBoard: React.FC<Props> = ({ categories, grid, onSelect, readOnly }) => {
  const colStyle: React.CSSProperties = { gridTemplateColumns: `repeat(${Math.max(1, categories.length)}, 1fr)` };
  return (
    <div className="gq-board">
      <div className="gq-header-row" style={colStyle}>
        {categories.map((c, i) => (
          <div key={i} className="gq-header-cell">{c}</div>
        ))}
      </div>
      <div className="gq-grid">
        {grid[0]?.map((_, rowIdx) => (
          <div key={rowIdx} className="gq-row" style={colStyle}>
            {categories.map((_, colIdx) => {
              const clue = grid[colIdx]?.[rowIdx];
              const disabled = !!clue?.taken;
              return (
                <button
                  key={`${colIdx}-${rowIdx}`}
                  className={`gq-cell ${disabled ? 'taken' : ''}`}
                  onClick={() => !readOnly && !disabled && onSelect && onSelect(colIdx, rowIdx)}
                  disabled={readOnly || disabled}
                >
                  {clue?.label || ''}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GridQuestBoard;



