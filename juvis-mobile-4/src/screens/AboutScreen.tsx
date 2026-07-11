import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Alert,
  StyleSheet, SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native';
import { refreshFltRouteDbFromSupabase, insertDummyData } from '../lib/database';

const RED = '#DC1E28';

export default function AboutScreen({ onBack, onNavigate }: { onBack: () => void; onNavigate?: (screen: string) => void }) {
  const [updating, setUpdating]   = useState(false);
  const [inserting, setInserting] = useState(false);

  const handleInsertDummy = async () => {
    setInserting(true);
    try {
      await insertDummyData();
      Alert.alert('완료', '테스트 데이터 5건이 삽입되었습니다.\n로그북 화면을 새로고침해서 확인하세요.');
    } catch (e) {
      Alert.alert('오류', String(e));
    } finally {
      setInserting(false);
    }
  };

  const handleUpdateRouteDb = async () => {
    setUpdating(true);
    try {
      const count = await refreshFltRouteDbFromSupabase();
      Alert.alert('업데이트 완료', `노선 DB ${count}건을 최신 데이터로 갱신했습니다.`);
    } catch (e) {
      Alert.alert('업데이트 실패', `네트워크 연결을 확인해주세요.\n${String(e)}`);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.backText}>← 메인메뉴</Text>
        </TouchableOpacity>
        <Text style={s.title}>저작권 및 문의</Text>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.section}>이스타항공 모바일 파일럿 로그북</Text>
        <Text style={s.line}>EastarJet Mobile Pilot&apos;s Logbook</Text>
        <View style={s.divider} />
        <Text style={s.label}>버전</Text>
        <Text style={s.value}>1.0.0</Text>
        <Text style={s.label}>개발</Text>
        <Text style={s.value}>이스타항공 파일럿 전용 내부 앱</Text>
        <Text style={s.label}>문의</Text>
        <Text style={s.value}>jujusangsacompany@gmail.com</Text>
        <View style={s.divider} />

        {/* ─── 노선 DB 업데이트 ─── */}
        <Text style={s.label}>노선 자동완성 DB</Text>
        <Text style={s.hint}>
          편명 입력 시 사용되는 출발/도착 공항 마스터 데이터입니다.{'\n'}
          온라인 상태에서 최신 데이터를 받아올 수 있습니다.
        </Text>
        <TouchableOpacity
          style={[s.updateBtn, updating && s.updateBtnDisabled]}
          onPress={handleUpdateRouteDb}
          disabled={updating}
        >
          {updating
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.updateBtnText}>노선 DB 업데이트</Text>
          }
        </TouchableOpacity>

        {/* ─── 개인정보처리방침 링크 ─── */}
        <TouchableOpacity
          style={s.privacyBtn}
          onPress={() => onNavigate?.('privacy')}
        >
          <Text style={s.privacyBtnText}>개인정보처리방침 보기</Text>
        </TouchableOpacity>

        {/* ─── DEV ONLY: 테스트 데이터 삽입 ─── */}
        {__DEV__ && (
          <>
            <View style={s.divider} />
            <Text style={s.devLabel}>🛠 개발자 메뉴</Text>
            <TouchableOpacity
              style={[s.devBtn, inserting && s.updateBtnDisabled]}
              onPress={handleInsertDummy}
              disabled={inserting}
            >
              {inserting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.devBtnText}>스크린샷용 더미 데이터 삽입</Text>
              }
            </TouchableOpacity>
          </>
        )}

        <View style={s.divider} />
        <Text style={s.copyright}>
          © 2026 JUJUSANGSA. All rights reserved.{'\n'}
          본 앱은 이스타항공 파일럿 전용 소프트웨어입니다.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RED,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: { paddingVertical: 2 },
  backText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  body: { padding: 28 },
  section: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  line: { fontSize: 13, color: '#888' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  label: { fontSize: 12, color: '#999', marginTop: 12, fontWeight: '600', letterSpacing: 0.3 },
  value: { fontSize: 15, color: '#333', marginTop: 2 },
  hint: { fontSize: 13, color: '#aaa', marginTop: 6, lineHeight: 19 },
  updateBtn: {
    marginTop: 12,
    backgroundColor: RED,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  updateBtnDisabled: { opacity: 0.5 },
  updateBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  privacyBtn: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: RED,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  privacyBtnText: { color: RED, fontSize: 14, fontWeight: '600' },
  copyright: { fontSize: 12, color: '#aaa', lineHeight: 18, textAlign: 'center', marginTop: 8 },
  devLabel: { fontSize: 11, color: '#bbb', fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  devBtn: {
    backgroundColor: '#555',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  devBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
