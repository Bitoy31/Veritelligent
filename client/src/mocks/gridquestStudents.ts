export type MockStudent = { id: string; name: string };

export const mockAllStudents: MockStudent[] = [
  { id: 'stu_001', name: 'Alex Cruz' },
  { id: 'stu_002', name: 'Jamie Santos' },
  { id: 'stu_003', name: 'Ramon Dela Cruz' },
  { id: 'stu_004', name: 'Kyla Reyes' },
  { id: 'stu_005', name: 'Miguel Garcia' },
  { id: 'stu_006', name: 'Patricia Lim' },
  { id: 'stu_007', name: 'Jerome Aquino' },
  { id: 'stu_008', name: 'Ella Ramos' },
  { id: 'stu_009', name: 'John Paul Tan' },
  { id: 'stu_010', name: 'Mariel Co' },
  { id: 'stu_011', name: 'Andre Bautista' },
  { id: 'stu_012', name: 'Denise Uy' },
  { id: 'stu_013', name: 'Paolo Mendoza' },
  { id: 'stu_014', name: 'Erika Fabian' },
  { id: 'stu_015', name: 'Jasper Ong' },
  { id: 'stu_016', name: 'Bea Navarro' },
  { id: 'stu_017', name: 'Nico Soriano' },
  { id: 'stu_018', name: 'Gwen Santos' },
  { id: 'stu_019', name: 'Leo Fernandez' },
  { id: 'stu_020', name: 'Ivy Ramos' },
  { id: 'stu_021', name: 'Carlito Vega' },
  { id: 'stu_022', name: 'Monica Dizon' },
  { id: 'stu_023', name: 'Rhea Abad' },
  { id: 'stu_024', name: 'Vince Chua' },
  { id: 'stu_025', name: 'Kelly Cruz' },
  { id: 'stu_026', name: 'Arvin Go' },
  { id: 'stu_027', name: 'Trixie Sison' },
  { id: 'stu_028', name: 'Luis Santos' },
  { id: 'stu_029', name: 'Hannah Lim' },
  { id: 'stu_030', name: 'Daryl Yao' },
  { id: 'stu_031', name: 'Mia Torres' },
  { id: 'stu_032', name: 'Kevin Lee' },
  { id: 'stu_033', name: 'Shane David' },
  { id: 'stu_034', name: 'Allan Perez' },
  { id: 'stu_035', name: 'Katrina Cruz' },
  { id: 'stu_036', name: 'Rico Dizon' },
  { id: 'stu_037', name: 'Faith Ramos' },
  { id: 'stu_038', name: 'Zachary Tan' },
  { id: 'stu_039', name: 'Lara Gatchalian' },
  { id: 'stu_040', name: 'Owen Cruz' },
];

// A subset of "present" / active student ids (simulate who joined via room code)
export const mockPresentStudentIds: string[] = [
  'stu_001','stu_002','stu_003','stu_004','stu_005','stu_006','stu_007','stu_008','stu_009','stu_010',
  'stu_012','stu_014','stu_016','stu_017','stu_019','stu_021','stu_024','stu_027','stu_031','stu_034'
];

export function getMockPresentStudents() {
  const presentSet = new Set(mockPresentStudentIds);
  return mockAllStudents
    .filter(s => presentSet.has(s.id))
    .map(s => ({ id: s.id, name: s.name, isReady: true }));
}


