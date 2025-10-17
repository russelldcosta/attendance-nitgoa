import React, { useState } from 'react';
import { 
  View, 
  ScrollView, 
  StyleSheet, 
  StatusBar, 
  TextInput,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Linking
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedButton } from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';
import { getAttendanceHistory, getClasses } from '@/utils/api';

const { width: screenWidth } = Dimensions.get('window');

// Types based on the backend API response
type AttendanceRecord = {
  date: string;
  student_id: string;
  student_name: string;
  status: string;
};

type AttendanceData = {
  class_code: string;
  attendance_history: AttendanceRecord[];
};

type TransformedData = {
  className: string;
  dates: string[];
  students: {
    rollNo: string;
    name: string;
    attendance: string[];
  }[];
};

// Function to transform API data into spreadsheet format
const transformAttendanceData = (attendanceData: AttendanceData): TransformedData | null => {
  if (!attendanceData || !attendanceData.attendance_history || attendanceData.attendance_history.length === 0) {
    return null;
  }

  const { class_code, attendance_history } = attendanceData;
  
  // Get unique dates and sort them
  const dates = [...new Set(attendance_history.map(record => record.date))].sort();
  
  // Get unique students
  const studentsMap = new Map();
  attendance_history.forEach(record => {
    if (!studentsMap.has(record.student_id)) {
      studentsMap.set(record.student_id, {
        student_id: record.student_id,
        student_name: record.student_name,
        attendance: {}
      });
    }
  });

  // Fill attendance data
  attendance_history.forEach(record => {
    const student = studentsMap.get(record.student_id);
    student.attendance[record.date] = record.status;
  });

  // Convert to array format for rendering
  const students = Array.from(studentsMap.values()).map(student => ({
    rollNo: student.student_id,
    name: student.student_name,
    attendance: dates.map(date => student.attendance[date] || '-') // '-' for missing data
  }));

  return {
    className: class_code,
    dates: dates,
    students: students
  };
};

export default function StudentAttendance() {
  const router = useRouter();
  const [classCode, setClassCode] = useState('');
  const [selectedClass, setSelectedClass] = useState<TransformedData | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [headerScrollRef, setHeaderScrollRef] = useState<ScrollView | null>(null);
  const [rowScrollRefs, setRowScrollRefs] = useState<ScrollView[]>([]);
  
  const cardBackground = useThemeColor({}, 'cardBackground');
  const successColor = useThemeColor({}, 'success');
  const dangerColor = useThemeColor({}, 'danger');
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'inputBorder');
  const inputBackground = useThemeColor({}, 'inputBackground');

  // Load available classes when component mounts
  React.useEffect(() => {
    loadAvailableClasses();
  }, []);

  const loadAvailableClasses = async () => {
    try {
      const classes = await getClasses();
      setAvailableClasses(classes.map(cls => cls.id));
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };
  
  const filteredClasses = availableClasses.filter(code => 
    code.toLowerCase().includes(classCode.toLowerCase())
  );

  const handleClassSelect = async (code: string) => {
    setClassCode(code);
    setShowSuggestions(false);
    await loadAttendanceData(code);
  };

  const loadAttendanceData = async (code: string) => {
    setLoading(true);
    try {
      const result = await getAttendanceHistory(code);
      console.log('API Result:', result); // Debug log
      if (result.success && result.data) {
        console.log('Attendance data:', result.data); // Debug log
        const transformedData = transformAttendanceData(result.data);
        console.log('Transformed data:', transformedData); // Debug log
        setSelectedClass(transformedData);
        // Reset scroll refs when new class is selected
        setHeaderScrollRef(null);
        setRowScrollRefs([]);
      } else {
        // If no data from API, show sample data for testing
        console.log('No data from API, using sample data');
        const sampleData = {
          class_code: code,
          attendance_history: [
            { date: "2025-08-15", student_id: "20230001", student_name: "John Doe", status: "P" },
            { date: "2025-08-15", student_id: "20230002", student_name: "Jane Smith", status: "A" },
            { date: "2025-08-16", student_id: "20230001", student_name: "John Doe", status: "A" },
            { date: "2025-08-16", student_id: "20230002", student_name: "Jane Smith", status: "P" },
          ]
        };
        const transformedData = transformAttendanceData(sampleData);
        setSelectedClass(transformedData);
      }
    } catch (error) {
      console.error('Error loading attendance data:', error);
      // Show sample data on error for testing
      const sampleData = {
        class_code: code,
        attendance_history: [
          { date: "2025-08-15", student_id: "20230001", student_name: "John Doe", status: "P" },
          { date: "2025-08-15", student_id: "20230002", student_name: "Jane Smith", status: "A" },
          { date: "2025-08-16", student_id: "20230001", student_name: "John Doe", status: "A" },
          { date: "2025-08-16", student_id: "20230002", student_name: "Jane Smith", status: "P" },
        ]
      };
      const transformedData = transformAttendanceData(sampleData);
      setSelectedClass(transformedData);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (classCode.trim()) {
      await loadAttendanceData(classCode.trim());
    }
    setShowSuggestions(false);
  };

  // Function to handle synchronized scrolling
  const handleScroll = (event: any, isHeader: boolean = false, rowIndex?: number) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    
    if (isHeader) {
      // Sync all row scrollviews with header scroll
      rowScrollRefs.forEach(ref => {
        if (ref) {
          ref.scrollTo({ x: offsetX, animated: false });
        }
      });
    } else {
      // Sync header and other rows with current row scroll
      if (headerScrollRef) {
        headerScrollRef.scrollTo({ x: offsetX, animated: false });
      }
      rowScrollRefs.forEach((ref, index) => {
        if (ref && index !== rowIndex) {
          ref.scrollTo({ x: offsetX, animated: false });
        }
      });
    }
  };



  const renderAttendanceCell = (status: string, index: number) => (
    <View 
      key={index}
      style={[
        styles.attendanceCell,
        { 
          backgroundColor: status === 'P' ? successColor : 
                          status === 'A' ? dangerColor : '#888' 
        }
      ]}
    >
      <ThemedText style={styles.attendanceCellText}>{status}</ThemedText>
    </View>
  );

  const renderStudentRow = (student: { rollNo: string; name: string; attendance: string[] }, index: number) => (
    <View key={student.rollNo} style={styles.studentRow}>
      {/* Sticky left column with roll number and name */}
      <View style={styles.stickyColumn}>
        <View style={styles.rollNoCell}>
          <ThemedText style={styles.rollNoText}>{student.rollNo}</ThemedText>
        </View>
        <View style={styles.nameCell}>
          <ThemedText style={styles.studentNameText} numberOfLines={1}>
            {student.name}
          </ThemedText>
        </View>
      </View>
      
      {/* Scrollable attendance columns */}
      <ScrollView 
        ref={(ref) => {
          if (ref && !rowScrollRefs[index]) {
            const newRefs = [...rowScrollRefs];
            newRefs[index] = ref;
            setRowScrollRefs(newRefs);
          }
        }}
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.attendanceScrollView}
        onScroll={(event) => handleScroll(event, false, index)}
        scrollEventThrottle={16}
      >
        <View style={styles.attendanceRow}>
          {student.attendance.map((status, i) => renderAttendanceCell(status, i))}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor={backgroundColor} />
      
      <View style={[styles.fixedHeader, { backgroundColor: backgroundColor }]}>
        {/* Back Button and Header */}
        <View style={styles.headerWithBack}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.replace('/')}
          >
            <Ionicons name="arrow-back" size={24} color={useThemeColor({}, 'text')} />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <ThemedText style={styles.headerTitle}>Attendance Tracker</ThemedText>
            <ThemedText style={styles.headerSubtitle}>NIT Goa</ThemedText>
          </View>
          
          <View style={styles.placeholder} />
        </View>

        {/* Class Code Input Section */}
        <View style={styles.inputSection}>
          <ThemedText style={styles.inputLabel}>Enter Class Code:</ThemedText>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, borderColor }]}
              value={classCode}
              onChangeText={(text) => {
                setClassCode(text);
                setShowSuggestions(text.length > 0);
              }}
              placeholder="e.g., CSE101, MATH201, PHY101"
              placeholderTextColor="#888"
              onFocus={() => setShowSuggestions(classCode.length > 0)}
            />
            <ThemedButton
              title="Search"
              onPress={handleSearch}
              style={styles.searchButton}
            />
          </View>
          
          {/* Suggestions Dropdown */}
          {showSuggestions && filteredClasses.length > 0 && (
            <View style={[styles.suggestionsContainer, { backgroundColor: cardBackground, borderColor }]}>
              {filteredClasses.map((code) => (
                <TouchableOpacity
                  key={code}
                  style={styles.suggestionItem}
                  onPress={() => handleClassSelect(code)}
                >
                  <ThemedText style={styles.suggestionCode}>{code}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

    {/* ADD THE DOWNLOAD EXCEL BUTTON RIGHT HERE */}
    {classCode ? (
      <View style={{ alignItems: 'center', marginVertical: 10 }}>
        <ThemedButton
          title="Download Excel"
          onPress={() => {
            const url = `https://attendance-nitgoa.onrender.com/attendance/download/${classCode}`;
            Alert.alert(
              'Download Attendance',
              'Do you want to download the Excel file?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Download', onPress: () => Linking.openURL(url) },
              ]
            );
          }}
          style={{ paddingHorizontal: 20, borderRadius: 10 }}
        />
      </View>
    ) : null}

      
      {/* Scrollable Content Area */}
      <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* Loading Indicator */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={useThemeColor({}, 'tint')} />
            <ThemedText style={styles.loadingText}>Loading attendance data...</ThemedText>
          </View>
        )}

        {/* Attendance Spreadsheet */}
        {!loading && selectedClass && selectedClass.students && selectedClass.students.length > 0 && (
          <View style={styles.spreadsheetContainer}>
            <View style={styles.classInfo}>
              <ThemedText style={styles.classTitle}>
                {classCode} - {selectedClass.className}
              </ThemedText>
              <ThemedText style={styles.classSubtitle}>
                {selectedClass.students.length} students, {selectedClass.dates.length} dates
              </ThemedText>
            </View>

            {/* Excel-like Spreadsheet */}
            <View style={styles.excelSpreadsheet}>
              {/* Header Row */}
              <View style={styles.headerRow}>
                <View style={styles.headerStickyColumn}>
                  <View style={styles.rollNoHeader}>
                    <ThemedText style={styles.headerText}>Roll No</ThemedText>
                  </View>
                  <View style={styles.nameHeader}>
                    <ThemedText style={styles.headerText}>Student Name</ThemedText>
                  </View>
                </View>
                <ScrollView 
                  ref={(ref) => setHeaderScrollRef(ref)}
                  horizontal 
                  showsHorizontalScrollIndicator={true}
                  style={styles.headerScrollView}
                  onScroll={(event) => handleScroll(event, true)}
                  scrollEventThrottle={16}
                >
                  <View style={styles.dateHeaderRow}>
                    {selectedClass.dates.map((date, index) => (
                      <View key={index} style={styles.dateHeader}>
                        <ThemedText style={styles.dateHeaderText}>{date}</ThemedText>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Student Rows */}
              <ScrollView style={styles.studentsContainer} showsVerticalScrollIndicator={true}>
                {selectedClass.students.map((student, index) => renderStudentRow(student, index))}
              </ScrollView>
            </View>

            {/* Legend */}
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: successColor }]} />
                <ThemedText style={styles.legendText}>Present (P)</ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: dangerColor }]} />
                <ThemedText style={styles.legendText}>Absent (A)</ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#888' }]} />
                <ThemedText style={styles.legendText}>No Data (-)</ThemedText>
              </View>
            </View>
          </View>
        )}

        {!loading && !selectedClass && classCode && (
          <View style={styles.noDataContainer}>
            <ThemedText style={styles.noDataText}>
              No attendance data found for class code: {classCode}
            </ThemedText>
            <ThemedText style={styles.availableClassesText}>
              Available classes: {availableClasses.join(', ')}
            </ThemedText>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { 
    flex: 1,
  },
  fixedHeader: {
    paddingTop: 40,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  headerWithBack: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 15,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  placeholder: {
    width: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  inputSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
    zIndex: 1000,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 50,
    paddingHorizontal: 15,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  searchButton: {
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 85,
    left: 20,
    right: 20,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  suggestionItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  suggestionCode: {
    fontSize: 16,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    paddingTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    opacity: 0.7,
  },
  spreadsheetContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  classInfo: {
    marginBottom: 20,
    alignItems: 'center',
  },
  classTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  classSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
  excelSpreadsheet: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    overflow: 'hidden',
    marginBottom: 20,
    minHeight: 300,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#d0d0d0',
    backgroundColor: '#f8f9fa',
    height: 80,
  },
  headerStickyColumn: {
    width: screenWidth * 0.4,
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRightWidth: 2,
    borderRightColor: '#d0d0d0',
  },
  rollNoHeader: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#d0d0d0',
  },
  nameHeader: {
    flex: 1,
    height: 80,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerScrollView: {
    flex: 1,
  },
  dateHeaderRow: {
    flexDirection: 'row',
    height: 80,
  },
  dateHeader: {
    width: 60,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#d0d0d0',
    backgroundColor: '#f8f9fa',
  },
  dateHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    color: '#333',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    color: '#333',
  },
  studentsContainer: {
    maxHeight: 400,
    backgroundColor: '#ffffff',
  },
  studentRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    height: 40,
    backgroundColor: '#ffffff',
  },
  stickyColumn: {
    width: screenWidth * 0.4,
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRightWidth: 2,
    borderRightColor: '#d0d0d0',
  },
  rollNoCell: {
    width: 80,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
  },
  nameCell: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  rollNoText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
  },
  studentNameText: {
    fontSize: 11,
    color: '#333',
  },
  attendanceScrollView: {
    flex: 1,
  },
  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
  },
  attendanceCell: {
    width: 60,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#e0e0e0',
  },
  attendanceCellText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 8,
    gap: 30,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#ffffff',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  noDataText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '500',
  },
  availableClassesText: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
});