/**
 * 스마트 대학 학점 계산기 Pro (app.js)
 * 4.5 / 4.3 만점 기준 지원, 전공/교양 분리 분석, 학기별 필터, 목표 평점 시뮬레이터
 */

// === 성적 변환 기준표 데이터 ===
const GRADE_SCALES = {
  '4.5': [
    { grade: 'A+', point: 4.5 },
    { grade: 'A0', point: 4.0 },
    { grade: 'B+', point: 3.5 },
    { grade: 'B0', point: 3.0 },
    { grade: 'C+', point: 2.5 },
    { grade: 'C0', point: 2.0 },
    { grade: 'D+', point: 1.5 },
    { grade: 'D0', point: 1.0 },
    { grade: 'F',  point: 0.0 },
    { grade: 'P',  point: null }
  ],
  '4.3': [
    { grade: 'A+', point: 4.3 },
    { grade: 'A0', point: 4.0 },
    { grade: 'A-', point: 3.7 },
    { grade: 'B+', point: 3.3 },
    { grade: 'B0', point: 3.0 },
    { grade: 'B-', point: 2.7 },
    { grade: 'C+', point: 2.3 },
    { grade: 'C0', point: 2.0 },
    { grade: 'C-', point: 1.7 },
    { grade: 'D+', point: 1.3 },
    { grade: 'D0', point: 1.0 },
    { grade: 'D-', point: 0.7 },
    { grade: 'F',  point: 0.0 },
    { grade: 'P',  point: null }
  ]
};

// 학기 이름 포맷터
const SEMESTER_NAMES = {
  '1-1': '1학년 1학기',
  '1-2': '1학년 2학기',
  '2-1': '2학년 1학기',
  '2-2': '2학년 2학기',
  '3-1': '3학년 1학기',
  '3-2': '3학년 2학기',
  '4-1': '4학년 1학기',
  '4-2': '4학년 2학기',
  'summer': '여름 계절',
  'winter': '겨울 계절'
};

const CATEGORY_NAMES = {
  'major': '전공',
  'general': '교양',
  'other': '일반'
};

// === 앱 상태 관리 ===
const STORAGE_KEY = 'smart_grade_pro_subjects_v3';
const SETTINGS_KEY = 'smart_grade_pro_settings_v3';

let subjects = [];
let currentScale = '4.5';
let currentFilterSem = 'all';

// 성적을 현재 만점 기준에 맞추어 평점으로 변환
function getGradePoint(gradeStr, scale = currentScale) {
  const g = (gradeStr || '').trim().toUpperCase();
  const list = GRADE_SCALES[scale] || GRADE_SCALES['4.5'];
  const found = list.find(item => item.grade === g);
  if (found) return found.point;
  if (g === 'P') return null;
  return 0.0;
}

// 평점 평균(GPA) 계산 (C++ 원작 calculateGPA 알고리즘 확장)
function calculateGPA(items) {
  if (!items || items.length === 0) return 0.0;

  let totalWeightedScore = 0.0;
  let totalCredits = 0;

  for (const sub of items) {
    if (sub.grade === 'P' || sub.gradePoint === null) continue;
    totalWeightedScore += sub.gradePoint * sub.credits;
    totalCredits += sub.credits;
  }

  if (totalCredits === 0) return 0.0;
  return totalWeightedScore / totalCredits;
}

// 백분율 점수 환산
function calculatePercentage(gpa, scale = currentScale) {
  const max = parseFloat(scale);
  if (gpa <= 0) return '0.0';
  if (gpa >= max) return '100.0';
  if (gpa < 1.0) return Math.max(0, (gpa / 1.0) * 60).toFixed(1);
  const score = 60 + ((gpa - 1.0) * (40 / (max - 1.0)));
  return Math.min(100, Math.max(0, score)).toFixed(1);
}

// GPA에 따른 평가 코멘트
function getGpaComment(gpa, scale = currentScale) {
  const max = parseFloat(scale);
  const ratio = gpa / max;
  if (ratio >= 0.95) return '🏆 최우수 수석 수준 (Summa Cum Laude)';
  if (ratio >= 0.88) return '🌟 우등 졸업 수준 (Magna Cum Laude)';
  if (ratio >= 0.78) return '✨ 매우 우수한 성적 (Cum Laude)';
  if (ratio >= 0.67) return '👍 양호한 성적';
  if (ratio >= 0.45) return '📝 보통 수준';
  if (gpa > 0)       return '⚠️ 학사경고 주의 대상 (2.0 미만)';
  return '과목을 등록해주세요';
}

// 뱃지 클래스
function getGradeBadgeClass(grade) {
  const g = (grade || '').toUpperCase();
  if (g.startsWith('A')) return 'badge-a';
  if (g.startsWith('B')) return 'badge-b';
  if (g.startsWith('C')) return 'badge-c';
  if (g.startsWith('D')) return 'badge-d';
  if (g === 'P') return 'badge-p';
  return 'badge-f';
}

function getCategoryBadge(cat) {
  const c = cat || 'major';
  const name = CATEGORY_NAMES[c] || '전공';
  return `<span class="badge-cat badge-cat-${c}">${name}</span>`;
}

// === 스토리지 연동 ===
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) subjects = JSON.parse(raw);
    
    // 점수 재계산 (현재 scale 기준 동기화)
    subjects.forEach(s => {
      s.gradePoint = getGradePoint(s.grade, currentScale);
    });

    const settings = localStorage.getItem(SETTINGS_KEY);
    if (settings) {
      const parsed = JSON.parse(settings);
      if (parsed.scale) currentScale = parsed.scale;
      if (parsed.theme) applyTheme(parsed.theme);
    }
  } catch (err) {
    console.error('Failed to load data:', err);
    subjects = [];
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(subjects));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      scale: currentScale,
      theme: document.documentElement.getAttribute('data-theme') || 'light'
    }));
  } catch (err) {
    console.error('Failed to save data:', err);
  }
}

// === UI 렌더링 ===
function render() {
  renderGradeSelector();
  renderCriteriaTable();
  renderHeroStats();
  renderTable();
  renderDistribution();
  updateSimulator();
}

// 취득 성적 선택 그리드 렌더링 (4.5 vs 4.3 동적 대응)
function renderGradeSelector() {
  const container = document.getElementById('gradeChips');
  if (!container) return;

  const currentGradeVal = document.getElementById('gradeInput').value || 'A+';
  const scaleList = GRADE_SCALES[currentScale] || GRADE_SCALES['4.5'];

  container.innerHTML = '';
  scaleList.forEach(item => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `grade-chip ${item.grade === currentGradeVal ? 'active' : ''}`;
    btn.setAttribute('data-grade', item.grade);

    const ptDisplay = item.point !== null ? item.point.toFixed(1) : 'Pass';
    btn.innerHTML = `
      <span class="gc-name">${item.grade}</span>
      <span class="gc-pt">${ptDisplay}</span>
    `;

    btn.addEventListener('click', () => {
      container.querySelectorAll('.grade-chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('gradeInput').value = item.grade;
    });

    container.appendChild(btn);
  });

  const gradeHint = document.getElementById('gradeHint');
  if (gradeHint) gradeHint.textContent = `${currentScale} 만점 등급표`;

  // 모달 셀렉트박스도 함께 갱신
  const editGradeSelect = document.getElementById('editGrade');
  if (editGradeSelect) {
    editGradeSelect.innerHTML = scaleList.map(item => {
      const ptDisplay = item.point !== null ? item.point.toFixed(1) : 'Pass';
      return `<option value="${item.grade}">${item.grade} (${ptDisplay})</option>`;
    }).join('');
  }
}

// 기준표 렌더링
function renderCriteriaTable() {
  const container = document.getElementById('criteriaTableContainer');
  const indicator = document.getElementById('scaleIndicator');
  if (!container) return;

  if (indicator) indicator.textContent = `${currentScale} 만점 기준`;

  const scaleList = GRADE_SCALES[currentScale] || GRADE_SCALES['4.5'];
  let row1 = '', row2 = '';
  const half = Math.ceil(scaleList.length / 2);

  scaleList.slice(0, half).forEach(item => {
    const badgeClass = getGradeBadgeClass(item.grade);
    const ptDisplay = item.point !== null ? item.point.toFixed(1) : 'Pass';
    row1 += `<td><span class="badge-grade ${badgeClass}">${item.grade}</span> ${ptDisplay}</td>`;
  });

  scaleList.slice(half).forEach(item => {
    const badgeClass = getGradeBadgeClass(item.grade);
    const ptDisplay = item.point !== null ? item.point.toFixed(1) : 'Pass';
    row2 += `<td><span class="badge-grade ${badgeClass}">${item.grade}</span> ${ptDisplay}</td>`;
  });

  container.innerHTML = `
    <table class="criteria-table">
      <tr><th>등급</th>${row1}</tr>
      <tr><th>등급</th>${row2}</tr>
    </table>
  `;
}

// 대형 GPA 대시보드 및 지표 렌더링
function renderHeroStats() {
  const maxScaleVal = parseFloat(currentScale).toFixed(2);
  document.getElementById('heroScaleText').textContent = `${maxScaleVal} 만점 체계 기준 산출`;
  document.getElementById('gpaMaxScale').textContent = `/ ${maxScaleVal}`;
  document.getElementById('majorMaxScale').textContent = `/ ${maxScaleVal}`;
  document.getElementById('meterMaxLabel').textContent = currentScale;

  // 1. 전체 평점 계산
  const totalGpa = calculateGPA(subjects);
  document.getElementById('gpaScore').textContent = totalGpa.toFixed(2);

  // 2. 전공 평점 계산
  const majorSubs = subjects.filter(s => s.category === 'major');
  const majorGpa = calculateGPA(majorSubs);
  document.getElementById('majorGpaScore').textContent = majorGpa.toFixed(2);

  let majorCreditsCount = 0;
  majorSubs.forEach(s => majorCreditsCount += s.credits);
  document.getElementById('majorCreditsCount').textContent = majorCreditsCount;

  // 3. 지표 그리드
  let totalCreditsCount = 0;
  let gpaCreditsCount = 0;
  subjects.forEach(s => {
    totalCreditsCount += s.credits;
    if (s.grade !== 'P' && s.gradePoint !== null) {
      gpaCreditsCount += s.credits;
    }
  });

  document.getElementById('totalSubjects').innerHTML = `${subjects.length} <small>과목</small>`;
  document.getElementById('totalCredits').innerHTML = `${totalCreditsCount} <small>학점</small>`;
  document.getElementById('gpaCredits').innerHTML = `${gpaCreditsCount} <small>학점</small>`;
  document.getElementById('convertedPercent').innerHTML = `${calculatePercentage(totalGpa)} <small>점</small>`;
  document.getElementById('gpaGradeTag').textContent = subjects.length > 0 ? getGpaComment(totalGpa) : '과목을 등록해주세요';

  // 프로그레스 바
  const maxFloat = parseFloat(currentScale);
  const percentFill = Math.min(100, Math.max(0, (totalGpa / maxFloat) * 100));
  const barFill = document.getElementById('gpaBarFill');
  if (barFill) {
    barFill.style.width = `${percentFill}%`;
    if (totalGpa >= maxFloat * 0.9) barFill.style.background = '#38bdf8';
    else if (totalGpa >= maxFloat * 0.75) barFill.style.background = '#34d399';
    else if (totalGpa >= maxFloat * 0.5) barFill.style.background = '#fbbf24';
    else barFill.style.background = '#f87171';
  }
}

// 결과 테이블 렌더링 (학기 필터 지원)
function renderTable() {
  const tbody = document.getElementById('subjectListBody');
  const emptyState = document.getElementById('emptyState');
  const footer = document.getElementById('tableFooterSummary');
  const filterBadge = document.getElementById('currentFilterBadge');

  tbody.innerHTML = '';

  const filtered = currentFilterSem === 'all' 
    ? subjects 
    : subjects.filter(s => s.semester === currentFilterSem);

  if (filterBadge) {
    filterBadge.textContent = currentFilterSem === 'all' 
      ? '전체 학기 보기' 
      : `${SEMESTER_NAMES[currentFilterSem] || currentFilterSem} 보기`;
  }

  if (filtered.length === 0) {
    emptyState.style.display = 'block';
    footer.classList.add('hidden');
    return;
  }

  emptyState.style.display = 'none';
  footer.classList.remove('hidden');

  filtered.forEach((sub, fIndex) => {
    // 원본 배열 인덱스 찾기
    const originalIndex = subjects.indexOf(sub);
    const tr = document.createElement('tr');
    const badgeClass = getGradeBadgeClass(sub.grade);
    const pointText = sub.gradePoint !== null ? sub.gradePoint.toFixed(1) : 'Pass';
    const semName = SEMESTER_NAMES[sub.semester] || sub.semester || '1-1';

    tr.innerHTML = `
      <td class="col-idx">${fIndex + 1}</td>
      <td class="col-sem">${semName}</td>
      <td class="col-cat">${getCategoryBadge(sub.category)}</td>
      <td class="col-name">${escapeHtml(sub.name)}</td>
      <td class="col-credits">${sub.credits}</td>
      <td class="col-grade">
        <span class="badge-grade ${badgeClass}">${sub.grade}</span>
      </td>
      <td class="col-point">${pointText}</td>
      <td class="col-action">
        <button type="button" class="btn-icon-action btn-action-edit" data-index="${originalIndex}" title="'${escapeHtml(sub.name)}' 수정">
          ✏️
        </button>
        <button type="button" class="btn-icon-action btn-action-del" data-index="${originalIndex}" title="'${escapeHtml(sub.name)}' 삭제">
          ✕
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // 테이블 푸터 요약
  let fCredits = 0;
  filtered.forEach(s => fCredits += s.credits);
  const fGpa = calculateGPA(filtered).toFixed(2);

  document.getElementById('footerCount').textContent = filtered.length;
  document.getElementById('footerTotalCredits').textContent = fCredits;
  document.getElementById('footerGpa').textContent = `${fGpa} / ${currentScale}`;

  // 이벤트 바인딩
  tbody.querySelectorAll('.btn-action-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      deleteSubject(idx);
    });
  });

  tbody.querySelectorAll('.btn-action-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      openEditModal(idx);
    });
  });
}

// 등급 분포 차트 렌더링
function renderDistribution() {
  const container = document.getElementById('gradeDistribution');
  if (!container) return;

  const categories = [
    { label: 'A', prefix: 'A', color: '#10b981' },
    { label: 'B', prefix: 'B', color: '#3b82f6' },
    { label: 'C', prefix: 'C', color: '#f59e0b' },
    { label: 'D', prefix: 'D', color: '#f97316' },
    { label: 'F', prefix: 'F', color: '#ef4444' },
    { label: 'P', prefix: 'P', color: '#a855f7' }
  ];

  const total = subjects.length;
  let html = '';

  categories.forEach(cat => {
    const count = subjects.filter(s => {
      if (cat.prefix === 'P') return s.grade === 'P';
      if (cat.prefix === 'F') return s.grade === 'F';
      return s.grade.startsWith(cat.prefix);
    }).length;

    const pct = total > 0 ? Math.round((count / total) * 100) : 0;

    html += `
      <div class="dist-row">
        <span class="dist-label">${cat.label} 등급</span>
        <div class="dist-bar-track">
          <div class="dist-bar-fill" style="width: ${pct}%; background-color: ${cat.color};"></div>
        </div>
        <span class="dist-count">${count}과목 (${pct}%)</span>
      </div>
    `;
  });

  container.innerHTML = html;
}

// 목표 학점 시뮬레이터 연산
function updateSimulator() {
  const targetGpa = parseFloat(document.getElementById('simTargetGpa').value) || 4.0;
  const remainCredits = parseFloat(document.getElementById('simRemainCredits').value) || 30;
  const reqValEl = document.getElementById('simRequiredGpa');
  const reqNoteEl = document.getElementById('simRequiredText');
  const maxScaleVal = parseFloat(currentScale);

  let currentWeighted = 0;
  let currentGpaCredits = 0;

  subjects.forEach(s => {
    if (s.grade !== 'P' && s.gradePoint !== null) {
      currentWeighted += s.gradePoint * s.credits;
      currentGpaCredits += s.credits;
    }
  });

  if (currentGpaCredits === 0) {
    reqValEl.textContent = targetGpa.toFixed(2);
    reqNoteEl.textContent = `앞으로 남은 ${remainCredits}학점을 평균 ${targetGpa.toFixed(2)}점 받아야 합니다.`;
    return;
  }

  const targetTotalWeighted = targetGpa * (currentGpaCredits + remainCredits);
  const neededWeighted = targetTotalWeighted - currentWeighted;
  const requiredAvgGpa = neededWeighted / remainCredits;

  if (requiredAvgGpa > maxScaleVal) {
    reqValEl.textContent = `${requiredAvgGpa.toFixed(2)}`;
    reqValEl.style.color = '#ef4444';
    reqNoteEl.textContent = `⚠️ 만점(${maxScaleVal})을 초과하여 달성 불가능합니다. 목표를 조정해보세요.`;
  } else if (requiredAvgGpa <= 0) {
    reqValEl.textContent = '0.00';
    reqValEl.style.color = '#10b981';
    reqNoteEl.textContent = '🎉 남은 학점과 상관없이 이미 목표 평점을 달성했습니다!';
  } else {
    reqValEl.textContent = `${requiredAvgGpa.toFixed(2)} / ${currentScale}`;
    reqValEl.style.color = 'var(--primary)';
    reqNoteEl.textContent = `남은 ${remainCredits}학점 동안 학기 평균 ${requiredAvgGpa.toFixed(2)}점을 취득하면 목표 달성!`;
  }
}

// === 액션 함수들 ===

// 과목 추가
function addSubject(data) {
  const gradePoint = getGradePoint(data.grade, currentScale);
  const newSub = {
    name: data.name.trim(),
    semester: data.semester || '1-1',
    category: data.category || 'major',
    credits: parseFloat(data.credits) || 3,
    grade: data.grade.trim().toUpperCase(),
    gradePoint: gradePoint
  };

  subjects.push(newSub);
  saveData();
  render();
  showToast(`'${newSub.name}' 과목이 추가되었습니다!`, 'success');
}

// 과목 삭제
function deleteSubject(index) {
  if (index >= 0 && index < subjects.length) {
    const item = subjects[index];
    if (confirm(`'${item.name}' 과목을 삭제하시겠습니까?`)) {
      subjects.splice(index, 1);
      saveData();
      render();
      showToast(`'${item.name}' 과목이 삭제되었습니다.`, 'info');
    }
  }
}

// 과목 수정 모달 열기
function openEditModal(index) {
  const item = subjects[index];
  if (!item) return;

  document.getElementById('editIndex').value = index;
  document.getElementById('editName').value = item.name;
  document.getElementById('editSemester').value = item.semester || '1-1';
  document.getElementById('editCategory').value = item.category || 'major';
  document.getElementById('editCredits').value = item.credits;
  document.getElementById('editGrade').value = item.grade;

  document.getElementById('editModal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('editModal').classList.add('hidden');
}

// 수정 사항 저장
function saveEditSubject(e) {
  e.preventDefault();
  const idx = parseInt(document.getElementById('editIndex').value, 10);
  if (idx < 0 || idx >= subjects.length) return;

  const name = document.getElementById('editName').value.trim();
  const semester = document.getElementById('editSemester').value;
  const category = document.getElementById('editCategory').value;
  const credits = parseFloat(document.getElementById('editCredits').value) || 3;
  const grade = document.getElementById('editGrade').value;

  if (!name) {
    alert('과목명을 입력해주세요.');
    return;
  }

  subjects[idx] = {
    name,
    semester,
    category,
    credits,
    grade,
    gradePoint: getGradePoint(grade, currentScale)
  };

  saveData();
  render();
  closeEditModal();
  showToast(`'${name}' 과목 정보가 수정되었습니다!`, 'success');
}

// 전체 초기화
function clearAll() {
  if (subjects.length === 0) {
    showToast('초기화할 과목이 없습니다.', 'info');
    return;
  }
  if (confirm('등록된 모든 성적 데이터를 삭제하시겠습니까? (되돌릴 수 없습니다)')) {
    subjects = [];
    saveData();
    render();
    showToast('모든 과목 데이터가 초기화되었습니다.', 'info');
  }
}

// 샘플 데이터 불러오기 (학기별 + 전공/교양 풍부한 예시)
function loadSampleData() {
  subjects = [
    // 1-1
    { name: 'C언어 기초', semester: '1-1', category: 'major', credits: 3, grade: 'A+', gradePoint: getGradePoint('A+') },
    { name: '대학 이산수학', semester: '1-1', category: 'major', credits: 3, grade: 'A0', gradePoint: getGradePoint('A0') },
    { name: '교양 글쓰기와 토론', semester: '1-1', category: 'general', credits: 2, grade: 'B+', gradePoint: getGradePoint('B+') },
    { name: '신입생 세미나', semester: '1-1', category: 'other', credits: 1, grade: 'P', gradePoint: null },
    // 1-2
    { name: '자료구조', semester: '1-2', category: 'major', credits: 3, grade: 'A+', gradePoint: getGradePoint('A+') },
    { name: '객체지향 프로그래밍(C++)', semester: '1-2', category: 'major', credits: 3, grade: 'A0', gradePoint: getGradePoint('A0') },
    { name: '실용 영어회화', semester: '1-2', category: 'general', credits: 2, grade: 'B0', gradePoint: getGradePoint('B0') },
    // 2-1
    { name: '컴퓨터 알고리즘', semester: '2-1', category: 'major', credits: 3, grade: 'A0', gradePoint: getGradePoint('A0') },
    { name: '컴퓨터 구조', semester: '2-1', category: 'major', credits: 3, grade: 'B+', gradePoint: getGradePoint('B+') },
    { name: '데이터베이스 개론', semester: '2-1', category: 'major', credits: 3, grade: 'A+', gradePoint: getGradePoint('A+') },
    { name: '현대 사회와 심리학', semester: '2-1', category: 'general', credits: 3, grade: 'A0', gradePoint: getGradePoint('A0') }
  ];

  saveData();
  render();
  showToast('전공 및 교양이 포함된 예시 데이터가 로드되었습니다!', 'success');
}

// CSV 내보내기
function exportCsv() {
  if (subjects.length === 0) {
    showToast('저장할 과목 데이터가 없습니다.', 'error');
    return;
  }

  const gpa = calculateGPA(subjects).toFixed(2);
  let csv = '\uFEFF';
  csv += '번호,학기,구분,과목명,학점,성적,환산평점\r\n';

  subjects.forEach((s, idx) => {
    const sem = SEMESTER_NAMES[s.semester] || s.semester;
    const cat = CATEGORY_NAMES[s.category] || s.category;
    const pt = s.gradePoint !== null ? s.gradePoint.toFixed(1) : 'Pass';
    csv += `"${idx + 1}","${sem}","${cat}","${s.name.replace(/"/g, '""')}","${s.credits}","${s.grade}","${pt}"\r\n`;
  });

  csv += `\r\n,"전체 평점 (GPA)","${currentScale} 만점 기준","${gpa}",""\r\n`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `대학성적표_${currentScale}만점_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('성적표가 CSV 파일로 다운로드되었습니다.', 'success');
}

// JSON 백업
function backupJson() {
  if (subjects.length === 0) {
    showToast('백업할 성적 데이터가 없습니다.', 'error');
    return;
  }
  const data = {
    version: '2.0',
    scale: currentScale,
    exportDate: new Date().toISOString(),
    subjects: subjects
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `성적백업_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('성적 백업 파일(JSON)이 저장되었습니다.', 'success');
}

// JSON 복원
function restoreJson(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data && Array.isArray(data.subjects)) {
        subjects = data.subjects;
        if (data.scale && (data.scale === '4.5' || data.scale === '4.3')) {
          currentScale = data.scale;
          updateScaleButtons();
        }
        subjects.forEach(s => s.gradePoint = getGradePoint(s.grade, currentScale));
        saveData();
        render();
        showToast(`성공적으로 ${subjects.length}개 과목을 복원했습니다!`, 'success');
      } else {
        alert('올바른 성적 백업 파일 형식이 아닙니다.');
      }
    } catch (err) {
      alert('파일을 읽는 도중 오류가 발생했습니다: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// 테마 관리 (Dark / Light)
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.getElementById('themeIcon');
  if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  saveData();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  showToast(next === 'dark' ? '다크 모드로 전환되었습니다.' : '라이트 모드로 전환되었습니다.', 'info');
}

// 스케일 버튼 UI 업데이트
function updateScaleButtons() {
  document.querySelectorAll('.segmented-control .seg-btn').forEach(btn => {
    if (btn.getAttribute('data-scale') === currentScale) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  document.getElementById('simTargetGpa').max = currentScale;
  if (parseFloat(document.getElementById('simTargetGpa').value) > parseFloat(currentScale)) {
    document.getElementById('simTargetGpa').value = currentScale;
  }
}

// 토스트 메시지
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// HTML 이스케이프
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// === 초기화 및 이벤트 리스너 바인딩 ===
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  updateScaleButtons();
  render();

  // 1. 만점 기준 토글 (4.5 vs 4.3)
  document.querySelectorAll('.segmented-control .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const scale = btn.getAttribute('data-scale');
      if (scale === currentScale) return;
      currentScale = scale;
      updateScaleButtons();
      // 기존 과목 평점 재동기화
      subjects.forEach(s => s.gradePoint = getGradePoint(s.grade, currentScale));
      saveData();
      render();
      showToast(`${currentScale} 만점 체계로 변경되었습니다!`, 'success');
    });
  });

  // 2. 테마 토글
  document.getElementById('btnThemeToggle').addEventListener('click', toggleTheme);

  // 3. 이수 구분 칩 클릭 (전공 / 교양 / 일반)
  const catChips = document.querySelectorAll('#categoryChips .cat-btn');
  const catInput = document.getElementById('categoryInput');
  catChips.forEach(btn => {
    btn.addEventListener('click', () => {
      catChips.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      catInput.value = btn.getAttribute('data-cat');
    });
  });

  // 4. 학점 칩 클릭
  const creditChips = document.querySelectorAll('#creditChips .chip-btn');
  const creditInput = document.getElementById('creditsInput');
  creditChips.forEach(btn => {
    btn.addEventListener('click', () => {
      creditChips.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      creditInput.value = btn.getAttribute('data-credit');
    });
  });

  // 5. 폼 제출 (과목 등록)
  const form = document.getElementById('subjectForm');
  const nameInput = document.getElementById('subjectName');
  const semesterSelect = document.getElementById('subjectSemester');
  const gradeInput = document.getElementById('gradeInput');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      showToast('과목명을 입력해주세요.', 'error');
      nameInput.focus();
      return;
    }

    addSubject({
      name: name,
      semester: semesterSelect.value,
      category: catInput.value,
      credits: creditInput.value,
      grade: gradeInput.value
    });

    nameInput.value = '';
    nameInput.focus();
  });

  // 6. 학기 필터 탭 클릭
  document.querySelectorAll('#semesterTabs .sem-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#semesterTabs .sem-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilterSem = tab.getAttribute('data-sem');
      renderTable();
    });
  });

  // 7. 모달 이벤트
  document.getElementById('btnModalClose').addEventListener('click', closeEditModal);
  document.getElementById('btnModalCancel').addEventListener('click', closeEditModal);
  document.getElementById('editForm').addEventListener('submit', saveEditSubject);
  document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target.id === 'editModal') closeEditModal();
  });

  // 8. 시뮬레이터 입력 반응
  document.getElementById('simTargetGpa').addEventListener('input', updateSimulator);
  document.getElementById('simRemainCredits').addEventListener('input', updateSimulator);
  document.getElementById('btnToggleSim').addEventListener('click', () => {
    const simBody = document.getElementById('simBody');
    simBody.classList.toggle('hidden');
  });

  // 9. 백업 / 복원
  document.getElementById('btnBackup').addEventListener('click', backupJson);
  const restoreFile = document.getElementById('restoreFileInput');
  document.getElementById('btnRestoreTrigger').addEventListener('click', () => restoreFile.click());
  restoreFile.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      restoreJson(e.target.files[0]);
      restoreFile.value = '';
    }
  });

  // 10. 공통 액션 버튼
  document.getElementById('btnClearAll').addEventListener('click', clearAll);
  document.getElementById('btnSampleData').addEventListener('click', loadSampleData);
  document.getElementById('btnEmptySample').addEventListener('click', loadSampleData);
  document.getElementById('btnExportCsv').addEventListener('click', exportCsv);
  document.getElementById('btnPrint').addEventListener('click', () => window.print());
});
